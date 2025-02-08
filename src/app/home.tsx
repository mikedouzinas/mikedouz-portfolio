"use client";
import React from 'react';
import HomeContent from './../components/home_content';

type HomeSectionProps = {
  onSeeMore?: () => void;
};

export default function HomeSection({ onSeeMore }: HomeSectionProps) {
  return (
    <HomeContent
      imageContainerSize="w-[16.5rem] h-[16.5rem]"
      imageSize="w-[16rem] h-[16rem]"
      headingSize="text-5xl md:text-8xl"
      subTextSize="mt-6 text-3xl"
      showSeeMore={true}
      onSeeMore={onSeeMore}
      containerClass="flex flex-col items-center justify-start py-8 text-center"
      textWrapperClass=""
    />
  );
}
