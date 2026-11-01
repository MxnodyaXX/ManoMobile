/** Shown the instant a product is clicked. */
export default function ProductLoading() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-8 md:px-8">
      <div className="mm-skel h-3 w-24" />
      <div className="mt-6 grid gap-10 md:grid-cols-2 md:gap-16">
        <div className="mm-skel aspect-square rounded-[32px]" />
        <div className="md:py-6">
          <div className="mm-skel h-3 w-40" />
          <div className="mm-skel mt-5 h-12 w-4/5" />
          <div className="mm-skel mt-6 h-8 w-32" />
          <div className="mm-skel mt-10 h-32 w-full" />
          <div className="mm-skel mt-8 h-14 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
