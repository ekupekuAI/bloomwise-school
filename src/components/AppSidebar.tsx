import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserPlus, Upload, ClipboardCheck,
  IndianRupee, PenLine, FileText, Bell, LogOut, X
} from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { useApp } from '@/context/AppContext';

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/add-student', label: 'Add Student', icon: UserPlus },
  { to: '/bulk-upload', label: 'Bulk Upload', icon: Upload },
  { to: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/fees', label: 'Fee Management', icon: IndianRupee },
  { to: '/marks-entry', label: 'Marks Entry', icon: PenLine },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/alerts', label: 'Parent Alerts', icon: Bell },
];

const teacherLinks = [
  { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/marks-entry', label: 'Marks Entry', icon: PenLine },
  { to: '/students', label: 'Students', icon: Users },
];

interface AppSidebarProps {
  role: 'admin' | 'teacher';
  open: boolean;
  onClose: () => void;
}

const AppSidebar = ({ role, open, onClose }: AppSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, school } = useApp();
  const links = role === 'admin' ? adminLinks : teacherLinks;

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-foreground/20 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-card border-r flex flex-col transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <BrandLogo className="h-9 w-9" />
            <span className="font-bold text-foreground truncate">SmartSchool</span>
          </Link>
          <button type="button" onClick={onClose} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        {role === 'admin' && school?.school_code && (
          <div className="px-4 py-2 text-xs text-muted-foreground border-b">
            <span className="font-medium text-foreground">School code</span>{' '}
            <span className="font-mono text-primary">{school.school_code}</span>
            <span className="block mt-0.5">Share with teachers to register.</span>
          </div>
        )}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map(link => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <link.icon className="w-4.5 h-4.5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <LogOut className="w-4.5 h-4.5" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
