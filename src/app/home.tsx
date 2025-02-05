// src/app/home.tsx
export default function HomeSection() {
  return (
    <section id="home" className="flex items-center justify-center py-20 bg-gray-100">
      <div className="text-center">
        <h1 className="text-5xl md:text-8xl font-bold text-gray-800">
          Hi, I'm{" "}
          <span className="inline-block align-middle mx-3">
            <div className="w-[9rem] h-[9rem] rounded-3xl border-4 border shadow-lg inline-flex items-center justify-center">
              <img
                src="/profile.png"
                alt="Mike Veson"
                className="w-[8rem] h-[8rem] rounded-2xl"
              />
            </div>
          </span>
          Mike Veson.
        </h1>
        <p className="mt-6 text-3xl text-gray-600">
          I'm a <strong>Computer Science Student</strong> at{" "}
          <strong>Rice University</strong>.
        </p>
      </div>
    </section>
  );
}
