// Nav is handled globally by AppNav in the root layout.
export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="min-h-screen">{children}</main>;
}
