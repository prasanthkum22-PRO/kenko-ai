import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleHome } from '../config/navigation';
import { IconActivity, IconHome, IconDashboard } from '../components/icons';

export default function NotFoundPage() {
  const { user } = useAuth();
  const homePath = user?.role ? roleHome(user.role) : '/login';

  return (
    <div className="notfound-page" id="notfound-page">
      <div className="max-w-xl mx-auto flex flex-col items-center text-center">
        <div className="notfound-code">
          <span className="notfound-4">4</span>
          <span className="notfound-0">
            <IconActivity size={28} />
          </span>
          <span className="notfound-4">4</span>
        </div>

        <h1 className="notfound-title">Page Not Found</h1>
        <p className="notfound-subtitle max-w-md">
          The page you're looking for doesn't exist or may have been moved.
          Let's get you back to the care dashboard.
        </p>

        <div className="flex flex-wrap gap-2 justify-center">
          <Link to={homePath} className="btn btn-primary btn-lg">
            <IconDashboard size={18} />
            Back to Dashboard
          </Link>
          <Link to="/" className="btn btn-secondary btn-lg">
            <IconHome size={18} />
            Return Home
          </Link>
        </div>

        <span className="text-caption mt-6">KENKO-AI · Enterprise Clinical Platform</span>
      </div>
    </div>
  );
}