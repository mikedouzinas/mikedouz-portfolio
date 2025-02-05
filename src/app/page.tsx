import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <div className="relative">
      <Head>
        <title>Mike Veson Portfolio</title>
        <meta name="description" content="Portfolio of Mike Veson" />
      </Head>
      <Header />
      {/* Add top padding so content isn't hidden behind the fixed header */}
      <main className="pt-20">
        {/* About Section */}
        <section id="about" className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl font-bold mb-4">About Me</h1>
            <p>Your introduction goes here.</p>
          </div>
        </section>

        {/* Projects Section */}
        <section id="projects" className="min-h-screen flex items-center justify-center">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl font-bold mb-4">Projects</h1>
            <p>Showcase your projects here.</p>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl font-bold mb-4">Contact</h1>
            <p>How people can reach you.</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
