import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="max-w-2xl mx-auto text-center">
        {/* Logo/Icon */}
        <div className="mb-8">
          <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Welcome to Sysist
          </h1>

          {/* Subtitle */}
          <p className="text-xl text-gray-600 mb-12 leading-relaxed">
            Your AI-powered booking assistant that makes phone calls for you.
            <br />
            Reserve restaurants, book hotels, and arrange taxi services with ease.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200">
            <div className="text-3xl mb-3">🍽️</div>
            <h3 className="font-semibold text-gray-900 mb-2">Restaurants</h3>
            <p className="text-sm text-gray-600">
              Book tables at your favorite restaurants
            </p>
          </div>

          <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200">
            <div className="text-3xl mb-3">🏨</div>
            <h3 className="font-semibold text-gray-900 mb-2">Hotels</h3>
            <p className="text-sm text-gray-600">
              Reserve rooms and check availability
            </p>
          </div>

          <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200">
            <div className="text-3xl mb-3">🚕</div>
            <h3 className="font-semibold text-gray-900 mb-2">Taxi</h3>
            <p className="text-sm text-gray-600">
              Arrange transportation and pickups
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <Link
          href="/chat?chatId=demo-chat&userId=demo-user"
          className="inline-block px-8 py-4 bg-black text-white rounded-full text-lg font-medium hover:bg-gray-800 transition-all hover:scale-105 shadow-lg"
        >
          Start Chatting
        </Link>

        {/* Footer note */}
        <p className="mt-8 text-sm text-gray-500">
          Powered by AI • Available 24/7 • No app download required
        </p>
      </div>
    </div>
  );
}
