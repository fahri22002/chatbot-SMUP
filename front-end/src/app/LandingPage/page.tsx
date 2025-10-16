'use client';

// import { useRouter } from 'next/navigation';
import Chatbot from '../chatbot/chatbot';

export default function Home() {
  // const router = useRouter();

  return (
    <main className="max-w-screen flex items-center justify-center bg-background text-foreground p-2">
      <div className="w-full max-w-8xl"> 
        {/* max-w-6xl = 1152px di layar besar, tetap responsive */}
        <Chatbot />
      </div>
    </main>
  );
}
