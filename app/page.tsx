import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/alpha');
  // Note: redirect() throws a NEXT_REDIRECT error, so this component will not render.
  // You can optionally return null or a loading indicator if preferred,
  // but it's generally not necessary as the redirect happens server-side.
  // return null; 
}
