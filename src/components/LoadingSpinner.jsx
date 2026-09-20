
/**
 * Full-screen loading spinner shown during initial auth check.
 * @param {{ message?: string, fullScreen?: boolean }} props
 */
export default function LoadingSpinner({ message = 'Loading...', fullScreen = false }) {
  return (
    <div className={`spinner-container ${fullScreen ? 'spinner-fullscreen' : ''}`}>
      <div className="spinner-orbit">
        <div className="spinner-core" />
        <div className="spinner-ring" />
        <div className="spinner-dot spinner-dot-1" />
        <div className="spinner-dot spinner-dot-2" />
        <div className="spinner-dot spinner-dot-3" />
      </div>
      {message && <p className="spinner-message">{message}</p>}
    </div>
  );
}
