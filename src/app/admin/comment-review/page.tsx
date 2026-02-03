import ReviewClient from "./reviewClient";

export const dynamic = "force-dynamic";

export default async function AdminCommentReviewPage() {
  return (
    <div className="min-h-screen px-4 py-6 md:px-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl md:text-2xl font-semibold">Comment Review</h1>
        <p className="text-sm opacity-80 mt-1">
          Approve pending/hidden comments, remove bad ones, and see report reasons.
        </p>
        <div className="mt-6">
          <ReviewClient />
        </div>
      </div>
    </div>
  );
}
