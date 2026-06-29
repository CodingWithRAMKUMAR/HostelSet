import Link from 'next/link';

export default function PaymentReturnPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <section className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-2xl font-bold text-slate-800">Payment submitted</h1>
        <p className="text-gray-500 mt-3">
          We are confirming the payment securely. Your dashboard will update after the payment provider sends confirmation.
        </p>
        <Link href="/owner/dashboard" className="inline-block mt-6 bg-orange-600 hover:bg-orange-700 text-white font-semibold px-5 py-3 rounded-xl">
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}
