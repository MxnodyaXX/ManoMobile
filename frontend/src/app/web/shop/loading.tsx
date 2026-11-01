/** Shown the instant "Shop" is clicked, while the catalogue loads. */
export default function ShopLoading() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-8 md:pt-16">
      <div className="mm-skel h-3 w-16" />
      <div className="mm-skel mt-5 h-16 w-[min(520px,80%)]" />
      <div className="mm-skel mt-5 h-4 w-72" />
      <div className="mm-skel mt-12 h-12 w-full rounded-full" />
      <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <div className="mm-skel aspect-[4/5] rounded-3xl" />
            <div className="mm-skel mt-4 h-3 w-20" />
            <div className="mm-skel mt-2 h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
