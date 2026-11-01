/**
 * A template (unlike the layout) is mounted fresh on every navigation, so each
 * page arrives with the same soft fade-and-rise (mm-page in motion.css) while
 * the nav and footer around it stay put.
 */
export default function WebTemplate({ children }: { children: React.ReactNode }) {
  return <div className="mm-page">{children}</div>;
}
