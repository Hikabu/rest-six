import { Suspense } from "react";
import BrowseClient from "./BrowseClient";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BrowseClient />
    </Suspense>
  );
}