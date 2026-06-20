import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="auth-loading">
        <p className="label-eyebrow">Authenticating…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
