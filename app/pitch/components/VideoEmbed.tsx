"use client";

import React from "react";

type VideoEmbedProps = {
  title?: string;
  videoId?: string; // YouTube ID
  className?: string;
};

export default function VideoEmbed({ title = "Studi demo backup video", videoId = "dQw4w9WgXcQ", className }: VideoEmbedProps) {
  const src = `https://www.youtube.com/embed/${videoId}?rel=0&cc_load_policy=1`;
  return (
    <div className={"w-full " + (className || "")}> 
      <iframe
        title={title}
        src={src}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="w-full aspect-video rounded-xl shadow"
      />
    </div>
  );
}


