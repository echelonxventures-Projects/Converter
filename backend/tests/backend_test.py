"""FileMorph backend tests - covers auth, files, conversion, editor, billing."""
import os, io, base64, struct, zlib
import pytest, requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://convert-hub-131.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin@filemorph.app", "password": "admin123"}


def _png_bytes():
    # 1x1 red PNG
    sig = b"\x89PNG\r\n\x1a\n"
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    idat = chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00"))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


@pytest.fixture(scope="module")
def admin_sess():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def png_id(admin_sess):
    r = admin_sess.post(f"{API}/files/upload", files={"file": ("t.png", _png_bytes(), "image/png")}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["file_id"]


@pytest.fixture(scope="module")
def txt_id(admin_sess):
    r = admin_sess.post(f"{API}/files/upload", files={"file": ("t.txt", b"hello world\nsecond line", "text/plain")}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["file_id"]


# ---------- auth ----------
class TestAuth:
    def test_register_and_me(self):
        s = requests.Session()
        import uuid
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "T"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["email"] == email
        assert "access_token" in s.cookies
        me = s.get(f"{API}/auth/me", timeout=30)
        assert me.status_code == 200
        assert me.json()["email"] == email

    def test_login_and_logout(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json=ADMIN, timeout=30)
        assert r.status_code == 200, r.text
        assert s.get(f"{API}/auth/me", timeout=30).status_code == 200
        assert s.post(f"{API}/auth/logout", timeout=30).status_code == 200
        # cookies cleared
        s.cookies.clear()
        assert s.get(f"{API}/auth/me", timeout=30).status_code == 401

    def test_login_bad(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@filemorph.app", "password": "wrong"}, timeout=30)
        assert r.status_code == 401


# ---------- public ----------
class TestPublic:
    def test_formats(self):
        r = requests.get(f"{API}/formats", timeout=30)
        assert r.status_code == 200
        j = r.json()
        assert "image" in j and "document" in j and "sheet" in j

    def test_billing_config(self):
        r = requests.get(f"{API}/billing/config", timeout=30)
        assert r.status_code == 200
        j = r.json()
        ids = [p["id"] for p in j["plans"]]
        assert {"free", "pro", "business"}.issubset(set(ids))
        assert len(j["credit_packs"]) == 3


# ---------- upload + convert + download ----------
class TestConvert:
    def test_upload(self, admin_sess, png_id):
        assert png_id

    def test_png_to_jpg(self, admin_sess, png_id):
        r = admin_sess.post(f"{API}/convert", json={"file_id": png_id, "target_format": "jpg"}, timeout=60)
        assert r.status_code == 200, r.text
        fid = r.json()["file_id"]
        d = admin_sess.get(f"{API}/files/download/{fid}", timeout=30)
        assert d.status_code == 200
        assert "attachment" in d.headers.get("Content-Disposition", "")
        assert len(d.content) > 0

    def test_png_to_pdf(self, admin_sess, png_id):
        r = admin_sess.post(f"{API}/convert", json={"file_id": png_id, "target_format": "pdf"}, timeout=60)
        assert r.status_code == 200, r.text

    def test_txt_to_pdf(self, admin_sess, txt_id):
        r = admin_sess.post(f"{API}/convert", json={"file_id": txt_id, "target_format": "pdf"}, timeout=60)
        assert r.status_code == 200, r.text
        d = admin_sess.get(f"{API}/files/download/{r.json()['file_id']}", timeout=30)
        assert d.content[:4] == b"%PDF"

    def test_txt_to_docx(self, admin_sess, txt_id):
        r = admin_sess.post(f"{API}/convert", json={"file_id": txt_id, "target_format": "docx"}, timeout=60)
        assert r.status_code == 200, r.text

    def test_txt_to_xlsx(self, admin_sess, txt_id):
        r = admin_sess.post(f"{API}/convert", json={"file_id": txt_id, "target_format": "xlsx"}, timeout=60)
        assert r.status_code == 200, r.text
        d = admin_sess.get(f"{API}/files/download/{r.json()['file_id']}", timeout=30)
        # xlsx is a zip - starts with PK
        assert d.content[:2] == b"PK"


# ---------- editor ----------
class TestEditor:
    def test_edit_image(self, admin_sess, png_id):
        r = admin_sess.post(f"{API}/edit/image",
                            json={"file_id": png_id, "brightness": 1.5, "grayscale": True, "rotate": 90, "out_format": "png"},
                            timeout=60)
        assert r.status_code == 200, r.text
        d = admin_sess.get(f"{API}/files/download/{r.json()['file_id']}", timeout=30)
        assert d.status_code == 200 and len(d.content) > 0

    def test_pdf_merge_and_split(self, admin_sess, txt_id):
        # produce two pdfs from txt
        ids = []
        for _ in range(2):
            r = admin_sess.post(f"{API}/convert", json={"file_id": txt_id, "target_format": "pdf"}, timeout=60)
            assert r.status_code == 200, r.text
            ids.append(r.json()["file_id"])
        m = admin_sess.post(f"{API}/edit/pdf/merge", json={"file_ids": ids}, timeout=60)
        assert m.status_code == 200, m.text
        merged_id = m.json()["file_id"]
        # split first one (single page)
        sp = admin_sess.post(f"{API}/edit/pdf/split", json={"file_id": ids[0], "ranges": [[1, 1]]}, timeout=60)
        assert sp.status_code == 200, sp.text
        assert len(sp.json()["files"]) == 1


# ---------- history ----------
class TestHistory:
    def test_history(self, admin_sess):
        r = admin_sess.get(f"{API}/files/history", timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        if items:
            assert all(it["kind"] in ("converted", "edited") for it in items)


# ---------- billing checkout ----------
class TestBilling:
    def test_checkout_plan(self, admin_sess):
        r = admin_sess.post(f"{API}/billing/checkout",
                            json={"item_type": "plan", "item_id": "pro", "origin_url": BASE_URL},
                            timeout=60)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "url" in j and "session_id" in j
        # status should not 500
        st = admin_sess.get(f"{API}/billing/status/{j['session_id']}", timeout=30)
        assert st.status_code == 200
        assert "payment_status" in st.json()

    def test_checkout_pack(self, admin_sess):
        r = admin_sess.post(f"{API}/billing/checkout",
                            json={"item_type": "pack", "item_id": "pack_50", "origin_url": BASE_URL},
                            timeout=60)
        assert r.status_code == 200, r.text
        assert "session_id" in r.json()


# ---------- free-plan daily limit ----------
class TestDailyLimit:
    def test_free_user_6th_blocked(self):
        import uuid
        s = requests.Session()
        email = f"limit_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "pass1234"}, timeout=30)
        assert r.status_code == 200
        up = s.post(f"{API}/files/upload", files={"file": ("t.png", _png_bytes(), "image/png")}, timeout=30)
        assert up.status_code == 200
        fid = up.json()["file_id"]
        statuses = []
        for i in range(6):
            cr = s.post(f"{API}/convert", json={"file_id": fid, "target_format": "jpg"}, timeout=60)
            statuses.append(cr.status_code)
        assert statuses[:5] == [200] * 5, f"first 5 should succeed got {statuses}"
        assert statuses[5] == 402, f"6th should be 402 got {statuses[5]}"
