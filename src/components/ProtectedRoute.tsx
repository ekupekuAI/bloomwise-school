import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import type { UserRole } from '@/context/AppContext';

type Props = {
  children: React.ReactNode;
  /** If set, only these roles may access the route. */
  allowedRoles?: UserRole[];
};

const ProtectedRoute = ({ children, allowedRoles }: Props) => {
  const { currentUser, userProfile, loading } = useApp();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!currentUser || !userProfile) {
    return (
      <Navigate to="/login" state={{ from: location.pathname }} replace />
    );
  }

  if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
    const fallback =
      userProfile.role === 'admin' ? '/admin' : '/teacher';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
