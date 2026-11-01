// Normal builds already use the Tailwind Turbopack loader. The optional server
// build uses the SAME 4.3.3 compiler through its PostCSS integration instead.
const config = {
  plugins: process.env.RADAR_LOW_MEMORY_BUILD === '1' ? {'@tailwindcss/postcss': {}} : {},
};
export default config;
