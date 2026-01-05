"use client";

import { useState, useEffect } from "react";

const FAKE_SEARCHES = [
  { query: "best weather apps 2024", results: [
    { title: "10 Best Weather Apps for iPhone and Android (2024)", url: "weather-apps.com", desc: "Compare the top weather apps with accurate forecasts, radar maps, and severe weather alerts..." },
    { title: "Weather.com - Local Weather Forecast, News and Conditions", url: "weather.com", desc: "Get the latest weather news and forecasts from Weather.com. Find local weather forecasts for cities around the world..." },
    { title: "AccuWeather: Weather Forecast & Local Radar", url: "accuweather.com", desc: "AccuWeather has local and international weather forecasts from the most accurate weather forecasting technology..." },
  ]},
  { query: "how to make pasta from scratch", results: [
    { title: "Homemade Pasta Recipe - Easy Fresh Pasta Dough", url: "allrecipes.com", desc: "Learn how to make fresh pasta from scratch with just flour and eggs. This simple recipe produces silky, delicious noodles..." },
    { title: "Fresh Pasta Dough Recipe | Food Network", url: "foodnetwork.com", desc: "Get Fresh Pasta Dough Recipe from Food Network. Mix flour with eggs and knead until smooth for perfect homemade pasta..." },
    { title: "How to Make Pasta: Step-by-Step Guide - Serious Eats", url: "seriouseats.com", desc: "Our complete guide to making fresh pasta at home, from mixing the dough to cutting noodles and cooking them perfectly..." },
  ]},
  { query: "best hiking trails near me", results: [
    { title: "AllTrails: Trail Guides & Maps for Hiking, Camping, and Running", url: "alltrails.com", desc: "Explore the best rated trails in your area. Browse trail maps and reviews from millions of outdoor enthusiasts..." },
    { title: "Find Hiking Trails & Outdoor Activities | REI Co-op", url: "rei.com", desc: "Discover hiking trails, camping spots, and outdoor adventures. Get expert advice and gear recommendations..." },
    { title: "National Park Trails - Best Hikes in America", url: "nps.gov", desc: "Find hiking trails in national parks across the United States. Plan your next outdoor adventure with trail maps and guides..." },
  ]},
  { query: "learn python programming free", results: [
    { title: "Python.org - Official Python Tutorial", url: "python.org", desc: "The official Python tutorial. Learn Python programming from the basics to advanced concepts with examples..." },
    { title: "Learn Python - Free Interactive Python Tutorial", url: "learnpython.org", desc: "Free interactive Python tutorial for beginners. Practice coding exercises and learn Python fundamentals..." },
    { title: "Python for Beginners | Codecademy", url: "codecademy.com", desc: "Start learning Python programming with our free course. Master variables, loops, functions and more..." },
  ]},
  { query: "home office setup ideas", results: [
    { title: "50 Home Office Ideas That Will Inspire Productivity", url: "architecturaldigest.com", desc: "Transform your workspace with these inspiring home office ideas. From minimalist setups to cozy corners..." },
    { title: "Best Home Office Setup Guide 2024 | Wirecutter", url: "nytimes.com/wirecutter", desc: "Our experts tested hundreds of products to find the best desk, chair, monitor, and accessories for your home office..." },
    { title: "Home Office Design Ideas - IKEA", url: "ikea.com", desc: "Create your perfect home office with IKEA furniture and storage solutions. Browse our gallery for inspiration..." },
  ]},
];

export default function IncognitoButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(FAKE_SEARCHES[0]);

  useEffect(() => {
    // Pick a random search when opening
    if (isOpen) {
      const randomIndex = Math.floor(Math.random() * FAKE_SEARCHES.length);
      setSearch(FAKE_SEARCHES[randomIndex]);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  return (
    <>
      {/* Floating Incognito Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 z-[100] px-3 py-1.5 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white text-xs font-medium border border-gray-600/50 shadow-lg backdrop-blur-sm transition-all hover:scale-105 flex items-center gap-1.5"
        title="Quickly Hide this screen with a Generic Search Page"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
        Incognito
      </button>

      {/* Full Screen Modal - Fake Google Search */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] bg-white overflow-auto">
          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="fixed top-4 right-4 z-[10000] w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Fake Google Header */}
          <div className="border-b border-gray-200 pb-3 pt-5 px-6">
            <div className="flex items-center gap-6 max-w-[700px]">
              {/* Google Logo */}
              <div className="text-2xl font-medium shrink-0">
                <span className="text-blue-500">G</span>
                <span className="text-red-500">o</span>
                <span className="text-yellow-500">o</span>
                <span className="text-blue-500">g</span>
                <span className="text-green-500">l</span>
                <span className="text-red-500">e</span>
              </div>

              {/* Search Bar */}
              <div className="flex-1 flex items-center border border-gray-300 rounded-full px-4 py-2 shadow-sm hover:shadow-md transition bg-white">
                <input
                  type="text"
                  value={search.query}
                  readOnly
                  className="flex-1 outline-none text-gray-800 text-sm bg-transparent"
                />
                <svg className="w-5 h-5 text-gray-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-6 mt-4 ml-24 text-sm">
              <span className="text-blue-600 border-b-2 border-blue-600 pb-3 px-1">All</span>
              <span className="text-gray-600 pb-3 px-1 cursor-pointer hover:text-gray-800">Images</span>
              <span className="text-gray-600 pb-3 px-1 cursor-pointer hover:text-gray-800">Videos</span>
              <span className="text-gray-600 pb-3 px-1 cursor-pointer hover:text-gray-800">News</span>
              <span className="text-gray-600 pb-3 px-1 cursor-pointer hover:text-gray-800">Maps</span>
            </div>
          </div>

          {/* Search Results */}
          <div className="max-w-[700px] px-6 py-4 ml-20">
            <p className="text-xs text-gray-600 mb-4">
              About {Math.floor(Math.random() * 900 + 100)},{Math.floor(Math.random() * 900 + 100)},000 results (0.{Math.floor(Math.random() * 90 + 10)} seconds)
            </p>

            {search.results.map((result, i) => (
              <div key={i} className="mb-6">
                <div className="text-xs text-gray-600 mb-1">
                  https://{result.url}
                </div>
                <h3 className="text-lg text-blue-700 hover:underline cursor-pointer mb-1">
                  {result.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {result.desc}
                </p>
              </div>
            ))}

            {/* People also ask */}
            <div className="mt-8 border border-gray-200 rounded-lg">
              <h4 className="px-4 py-3 text-gray-800 font-medium">People also ask</h4>
              {["What is the best option?", "How do I get started?", "Is this free to use?", "What are the alternatives?"].map((q, i) => (
                <div key={i} className="border-t border-gray-200 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50">
                  <span className="text-sm text-gray-700">{q}</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
