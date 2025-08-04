const Bongo = () => {
  return <h1 className="bg-red-500">Bongo</h1>;
};

export default function Index() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-9xl text-balance font-bold tracking-tight">
          Welcome to Your Blank App
        </h1>

        <Bongo />
      </div>
    </div>
  );
}
