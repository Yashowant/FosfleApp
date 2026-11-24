export const HTML_MODULES = [
  {
    id: "foundations",
    label: "Module 01",
    title: "HTML5 Foundations",
    subtitle: "How the web works, editors, tags, and core document anatomy",
    lessons: [
      { id: "intro_html", num: "01", title: "Introduction to HTML", mins: 6, file: "courses/html/chapters/intro_html.html", ex: "courses/html/chapters/excercises/intro_html_ex.html", ch: "courses/html/chapters/challenges/intro_html_ch.html" },
      { id: "editors_html", num: "02", title: "HTML Editors & Setup", mins: 5, file: "courses/html/chapters/editors_html.html", ex: "courses/html/chapters/excercises/editors_html_ex.html", ch: "courses/html/chapters/challenges/editors_html_ch.html" },
      { id: "basic_html", num: "03", title: "HTML Basic Documents", mins: 7, file: "courses/html/chapters/basic_html.html", ex: "courses/html/chapters/excercises/basics_html_ex.html", ch: "courses/html/chapters/challenges/basics_html_ch.html" },
      { id: "elements_html", num: "04", title: "HTML Elements", mins: 8, file: "courses/html/chapters/elements_html.html", ex: "courses/html/chapters/excercises/elements_html_ex.html", ch: "courses/html/chapters/challenges/elements_html_ch.html" },
      { id: "attributes_html", num: "05", title: "HTML Attributes", mins: 8, file: "courses/html/chapters/attributes_html.html", ex: "courses/html/chapters/excercises/attributes_html_ex.html", ch: "courses/html/chapters/challenges/attributes_html_ch.html" }
    ]
  },
  {
    id: "typography",
    label: "Module 02",
    title: "Text, Formatting & Styles",
    subtitle: "Headings, paragraphs, inline styles, comments, and color systems",
    lessons: [
      { id: "headings_html", num: "06", title: "HTML Headings", mins: 6, file: "courses/html/chapters/headings_html.html", ex: "courses/html/chapters/excercises/headings_html_ex.html", ch: "courses/html/chapters/challenges/headings_html_ch.html" },
      { id: "paragraphs_html", num: "07", title: "HTML Paragraphs", mins: 6, file: "courses/html/chapters/paragraphs_html.html", ex: "courses/html/chapters/excercises/paragraphs_html_ex.html", ch: "courses/html/chapters/challenges/paragraphs_html_ch.html" },
      { id: "styles_html", num: "08", title: "HTML Styles", mins: 8, file: "courses/html/chapters/styles_html.html", ex: "courses/html/chapters/excercises/styles_html_ex.html", ch: "courses/html/chapters/challenges/styles_html_ch.html" },
      { id: "formatting_html", num: "09", title: "Text Formatting", mins: 7, file: "courses/html/chapters/formatting_html.html", ex: "courses/html/chapters/excercises/formatting_html_ex.html", ch: "courses/html/chapters/challenges/formatting_html_ch.html" },
      { id: "comments_html", num: "10", title: "HTML Comments", mins: 5, file: "courses/html/chapters/comments_html.html", ex: "courses/html/chapters/excercises/comments_html_ex.html", ch: "courses/html/chapters/challenges/comments_html_ch.html" },
      { id: "colors_html", num: "11", title: "HTML Colors (HEX, RGB, HSL)", mins: 10, file: "courses/html/chapters/colors_html.html", ex: "courses/html/chapters/excercises/colors_html_ex.html", ch: "courses/html/chapters/challenges/colors_html_ch.html" }
    ]
  },
  {
    id: "media_links",
    label: "Module 03",
    title: "CSS, Links & Rich Media",
    subtitle: "Linking stylesheets, navigation, responsive images, favicons, and titles",
    lessons: [
      { id: "css_html", num: "12", title: "HTML & CSS Integration", mins: 11, file: "courses/html/chapters/css_html.html", ex: "courses/html/chapters/excercises/css_html_ex.html", ch: "courses/html/chapters/challenges/css_html_ch.html" },
      { id: "links_html", num: "13", title: "HTML Links & Anchors", mins: 9, file: "courses/html/chapters/links_html.html", ex: "courses/html/chapters/excercises/links_html_ex.html", ch: "courses/html/chapters/challenges/links_html_ch.html" },
      { id: "images_html", num: "14", title: "HTML Images", mins: 9, file: "courses/html/chapters/images_html.html", ex: "courses/html/chapters/excercises/images_html_ex.html", ch: "courses/html/chapters/challenges/images_html_ch.html" },
      { id: "favicon_html", num: "15", title: "HTML Favicon", mins: 7, file: "courses/html/chapters/favicon_html.html", ex: "courses/html/chapters/excercises/favicon_html_ex.html", ch: "courses/html/chapters/challenges/favicon_html_ch.html" },
      { id: "title_html", num: "16", title: "HTML Page Title & SEO", mins: 6, file: "courses/html/chapters/title_html.html", ex: "courses/html/chapters/excercises/title_html_ex.html", ch: "courses/html/chapters/challenges/title_html_ch.html" }
    ]
  },
  {
    id: "data_layout",
    label: "Module 04",
    title: "Data & Page Structure",
    subtitle: "Structured tables, ordered/unordered lists, and block vs inline flow",
    lessons: [
      { id: "tables_html", num: "17", title: "HTML Tables", mins: 10, file: "courses/html/chapters/tables_html.html", ex: "courses/html/chapters/excercises/tables_html_ex.html", ch: "courses/html/chapters/challenges/tables_html_ch.html" },
      { id: "lists_html", num: "18", title: "HTML Lists", mins: 7, file: "courses/html/chapters/lists_html.html", ex: "courses/html/chapters/excercises/lists_html_ex.html", ch: "courses/html/chapters/challenges/lists_html_ch.html" },
      { id: "blockinline_html", num: "19", title: "Block & Inline Elements", mins: 8, file: "courses/html/chapters/blockinline_html.html", ex: null, ch: null }
    ]
  }
];

export const ALL_LESSONS = HTML_MODULES.flatMap((m, mIdx) =>
  m.lessons.map((l) => ({ ...l, moduleId: m.id, moduleLabel: m.label, moduleTitle: m.title, moduleIndex: mIdx }))
);

export const UPCOMING_TRACKS = [
  {
    id: "adv-css",
    title: "Advanced CSS & Layouts",
    desc: "Flexbox, CSS Grid, fluid typography, and smooth keyframe motion.",
    image: "img/adv-css.webp",
    tag: "In Production"
  },
  {
    id: "python",
    title: "Python Programming",
    desc: "Core syntax, automation scripts, and data structures from scratch.",
    image: "img/python.webp",
    tag: "Roadmap"
  }
];

export const PLAYGROUND_STARTERS = [
  {
    name: "Profile Card",
    code: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; background: #f4f6fb; padding: 20px; }
    .card { background: #fff; border-radius: 16px; padding: 20px; border: 1px solid #e2e8f0; max-width: 340px; margin: 0 auto; }
    .badge { display: inline-block; background: #e8efff; color: #1d5bff; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 99px; }
    h2 { margin: 12px 0 6px; color: #0b1226; }
    p { color: #475569; line-height: 1.5; margin: 0 0 16px; }
    a.btn { display: inline-block; background: #1d5bff; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 10px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">HTML5 Learner</span>
    <h2>Hello from Fosfle!</h2>
    <p>Edit this code and tap <strong>Preview</strong> to see live changes immediately.</p>
    <a class="btn" href="#">Start Building</a>
  </div>
</body>
</html>`
  },
  {
    name: "HTML Table",
    code: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; padding: 18px; background: #fff; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; }
    th { background: #001240; color: #fff; }
    tr:nth-child(even) { background: #f8fafc; }
  </style>
</head>
<body>
  <h3>Weekly Study Plan</h3>
  <table>
    <tr><th>Day</th><th>Topic</th><th>Goal</th></tr>
    <tr><td>Mon</td><td>HTML Tags</td><td>3 Chapters</td></tr>
    <tr><td>Wed</td><td>CSS Styles</td><td>2 Quizzes</td></tr>
    <tr><td>Fri</td><td>Tables & Lists</td><td>1 Challenge</td></tr>
  </table>
</body>
</html>`
  },
  {
    name: "Block vs Inline",
    code: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; padding: 18px; }
    .block { background: #dbeafe; border-left: 4px solid #1d5bff; padding: 10px; margin-bottom: 10px; }
    .inline { background: #fef3c7; border: 1px solid #d97706; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="block">I am a <strong>block-level</strong> &lt;div&gt; element. I take the full width.</div>
  <p>Inside a paragraph, <span class="inline">&lt;span&gt;</span> and <strong class="inline">&lt;strong&gt;</strong> flow inline!</p>
</body>
</html>`
  }
];
