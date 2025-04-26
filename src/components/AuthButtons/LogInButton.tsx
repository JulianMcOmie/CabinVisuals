import Link from 'next/link';

const LogInButton: React.FC = () => {
  return (
    <Link href="/login" legacyBehavior>
        {/* Style matching the larger version from ProjectsDisplay */}
        <a className="rounded-full bg-indigo-600 px-5 py-2 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors">
            Log In
        </a>
    </Link>
  );
};

export default LogInButton; 