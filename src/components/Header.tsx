import Link from 'next/link';

export default function Header() {
  return (
    <header className="fixed top-0 w-full bg-white shadow z-10">
      <nav className="container mx-auto px-4 py-4 flex justify-between">
        <div className="font-bold text-xl">Mike Veson</div>
        <div className="space-x-4">
          <a href="#about" className="hover:text-blue-500">About</a>
          <a href="#projects" className="hover:text-blue-500">Projects</a>
          <a href="#contact" className="hover:text-blue-500">Contact</a>
        </div>
      </nav>
    </header>
  );
}
