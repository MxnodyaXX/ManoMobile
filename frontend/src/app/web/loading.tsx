/** Fallback for any website page that has no placeholder of its own. */
export default function WebLoading() {
  return (
    <div className="px-3 pt-3 md:px-5 md:pt-5">
      <div className="mm-skel h-[70vh] rounded-[28px] md:rounded-[36px]" />
    </div>
  );
}
