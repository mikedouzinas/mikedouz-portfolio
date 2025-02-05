import Head from 'next/head';
import Header from '../components/Header/Header';
import Footer from '../components/Footer';
import HomeSection from './home';
import About from './about';
import Projects from './projects';
import Blogs from './blogs';
import Experience from './experience';

export default function Home() {
  return (
    <div className="relative">
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
