import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/alpha');
  // Note: redirect() must be called outside of the return statement
  // It throws a NEXT_REDIRECT error, so this return is technically unreachable,
  // but good practice to have a null return for clarity.
  return null; 
}
