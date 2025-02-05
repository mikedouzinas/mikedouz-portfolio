// src/app/page.tsx
import Head from 'next/head';
import Header from '../components/Header/Header';
import Footer from '../components/Footer';
import HomeSection from './home';
import About from './about';
import Experience from './experience';
import Projects from './projects';
import Blogs from './blogs';

export default function Home() {
  return (
    <div id="top" className="relative">
      <Head>
        <title>Mike Veson Portfolio</title>
        <meta name="description" content="Portfolio of Mike Veson" />
      </Head>
      <Header />
      <main className="pt-20">
        <HomeSection />
        <About />
        <Experience />
        <Projects />
        <Blogs />
      </main>
      <Footer />
    </div>
  );
}
