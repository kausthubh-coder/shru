export default function ServerPage() {
  return (
    <main className="p-8 flex flex-col gap-4 mx-auto max-w-2xl">
      <h1 className="text-4xl font-bold text-center">Convex + Next.js</h1>
      <div className="flex flex-col gap-4 bg-slate-200 dark:bg-slate-800 p-4 rounded-md">
        <h2 className="text-xl font-bold">Server example</h2>
        <p className="text-sm text-gray-700 dark:text-gray-200">
          This page previously showed a numbers demo. It now serves as a placeholder you can
          repurpose for your own server-rendered data.
        </p>
      </div>
    </main>
  );
}
