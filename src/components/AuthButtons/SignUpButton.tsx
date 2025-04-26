import Link from 'next/link';

const SignUpButton: React.FC = () => {
  return (
    <Link href="/signup" legacyBehavior>
      {/* Style matching the larger version from ProjectsDisplay */}
      <a className="rounded-full border border-gray-600 px-5 py-2 text-base font-semibold text-gray-300 shadow-sm hover:border-gray-400 hover:text-white transition-colors">
        Sign Up
      </a>
    </Link>
  );
};

export default SignUpButton; 