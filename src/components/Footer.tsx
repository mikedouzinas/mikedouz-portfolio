export default function Footer() {
    return (
      <footer className="w-full border-t py-4 mt-8">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div>
            <a href="mailto:mike@douzinas.com" className="hover:text-blue-500">
              mike@douzinas.com
            </a>
          </div>
          <div className="space-x-4">
            <a
              href="https://www.linkedin.com/in/mikedouzinas"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-500"
            >
              LinkedIn
            </a>
            <a
              href="https://github.com/mikedouzinas"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-500"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    );
  }
  