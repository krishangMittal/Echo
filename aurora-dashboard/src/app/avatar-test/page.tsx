"use client";

import { SimpleCircularAvatar } from "@/components/SimpleCircularAvatar";

export default function AvatarTestPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-white text-2xl mb-8">Simple Circular Avatar Test</h1>

        {/* Test with a sample video URL - you can replace this with your actual video source */}
        <SimpleCircularAvatar
          videoSrc="/path/to/your/video.mp4" // Replace with your actual video source
          size={200}
          className="mx-auto"
        />

        <p className="text-gray-400 mt-4">
          Replace the videoSrc prop with your actual video source
        </p>
      </div>
    </div>
  );
}