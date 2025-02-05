// src/app/home.tsx
export default function HomeSection() {
    return (
      <section id="home" className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="flex flex-col items-center">
          {/* Profile image with blue outer circle and white inner circle */}
          <div className="mb-8">
            <div className="w-48 h-48 bg-blue-500 rounded-full flex items-center justify-center">
              <div className="w-44 h-44 bg-white rounded-full flex items-center justify-center">
                <img 
                  src="/profile.jpg" 
                  alt="Profile Picture" 
                  className="w-40 h-40 rounded-full object-cover" 
                />
              </div>
            </div>
          </div>
          {/* Welcome text */}
          <h1 className="text-4xl font-bold text-gray-800 text-center">
            Hello, I'm Michael Konstantinos Douzinas Veson
          </h1>
          <p className="mt-4 text-xl text-gray-600 text-center">
            Welcome to my digital portfolio, where creativity meets technology.
          </p>
        </div>
      </section>
    );
  }
  