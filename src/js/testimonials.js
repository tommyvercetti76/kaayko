import { getAllProducts } from "./kaayko_apiClient.js";

// 1) Image‐proxy base (reuse your existing Cloud Function)
const IMAGE_PROXY_BASE =
  "https://api-vwcc5j4qda-uc.a.run.app/images";

// 2) Your 20 fake reviews
const fakeTestimonials = [
  { name: "Alice Johnson",      review: "Absolutely amazing designs. Kaayko never disappoints! My mother in law was disappointed at first but then we fed her to pigs." },
  { name: "James Madison",       review: "I love the unique style and attention to detail. Highly recommend! A little expensive, but what price do you put on freedom of expressions?" },
  { name: "Katherine Murthy",   review: "My journey from a Neanderthal to Narayan is complete because I stumbled on Kaayko!" },
  { name: "David Kim",          review: "A premium brand that deserves premium prices. The kids in Nicaragua are OK with this!" },
  { name: "Emily Davis",        review: "The products are as innovative as they are beautiful. Very impressed on a 3 am Tuesday Morning!" },
  { name: "Frank Neutral",      review: "Outstanding designs. I wear my Kaayko shirt with pride. Not that one. But not that one either." },
  { name: "Grace Chen",         review: "The detail and care in every design is evident. Love it! My wife loved it and she's a nihilist!" },
  { name: "Bohran Mamdhany",    review: "High-quality, stylish, and questionably sustainable. Finally something impressed me after the elevator knob in my rehab clinic." },
  { name: "Isabella Rivera",    review: "Kaayko is enlightening. If Kaayko was a religion, I'd know it's not Kaayko." },
  { name: "Jack Thompson",      review: "The modern aesthetic and premium quality make Kaayko stand out. Do you know who else stands out? Racism." },
  { name: "Katherine Adams",      review: "Every piece feels uniquely crafted by a child. I can see the innocence in every stitch." },
  { name: "Kamlakar Lagingfeld",  review: "Top-notch materials and design. A truly remarkable brand. Makes me feel alive again!" },
  { name: "Yama Doot",       review: "Kaayko makes funerals funky and death marches danceable. Kaayko is fashion we never deserved! Wait, this is not the right forum??" },
  { name: "Noah Martinez",   review: "I appreciate the focus on sustainability. Their 'FUR-REAL - Furry Union for Rights — Repurposing Excess Animal Layers' program is a game changer." },
  { name: "Olivia Garcia",   review: "Beautifully designed and exceptionally comfortable. Highly recommended! I also highly recommend you staying hydrated." },
  { name: "Paul Anderson",   review: "An experience that elevates your style effortlessly. People will ask you, tell them to drink water. Don't encourage them to buy this. It's all mine." },
  { name: "Quinn Harris",    review: "Every product tells a story. Some stories are too long but then I remind myself it's not the stories but my attention span which sucks." },
  { name: "Rachel Clark",    review: "The craftsmanship is evident in every detail. A must-have brand! Even my unborn baby has an order placed for his eldest daughter!" },
  { name: "Samuel Lewis",    review: "Bold, innovative, and timeless. Kaayko has it all. If someone is offended, tell them to drink water and stay hydrated in this this heat of hatred." },
  { name: "Tina Reynolds",   review: "For a hill, men would kill. Why? They do not know. Exactly how I do not know why did I not know about Kaayko" }
];

/** Fisher–Yates shuffle */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Extract filename from signed URL */
function extractFileName(signedUrl) {
  const url = new URL(signedUrl);
  let path = url.pathname;

  // only decode if there’s an escaped slash
  if (path.includes('%2F')) {
    path = decodeURIComponent(path);
  }

  // now split on real slashes and take the last segment
  const segments = path.split('/');
  return segments.pop();
}

/** Compose your proxy URL */
function makeProxyUrl(productID, signedUrl) {
  const fileName = extractFileName(signedUrl);
  return `${IMAGE_PROXY_BASE}/${encodeURIComponent(productID)}/${encodeURIComponent(fileName)}`;
}

/** Build one testimonial card */
/** Build one testimonial card */
function createTestimonialCard({ name, review, imgSrc, votes }) {
  const card = document.createElement("div");
  card.className = "testimonial";

  // avatar block
  const avatarWrapper = document.createElement("div");
  avatarWrapper.className = "avatar-container";

  if (imgSrc) {
    const img = document.createElement("img");
    img.src = imgSrc;
    img.alt = name;
    avatarWrapper.appendChild(img);
  }

  // footer overlay with votes (now a heart instead of a star)
  const footer = document.createElement("div");
  footer.className = "avatar-footer";
  footer.innerHTML = `<i class="material-icons" aria-hidden="true">favorite</i> ${votes}`;
  avatarWrapper.appendChild(footer);

  // text content
  const content = document.createElement("div");
  content.className = "testimonial-content";
  const p = document.createElement("p");
  p.textContent = review;
  const who = document.createElement("span");
  who.className = "name";
  who.textContent = name;
  content.append(p, who);

  // assemble
  card.append(avatarWrapper, content);
  return card;
}

/**
 * Renders all 20 testimonials into #<containerId>
 */
export async function renderTestimonials(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  let products = [];
  try {
    products = await getAllProducts();
  } catch (err) {
    console.error("Couldn't load products:", err);
    container.textContent = "Unable to load testimonials.";
    return;
  }

  // build pool: one entry per product
  const pool = products
    .flatMap(p => {
      if (!Array.isArray(p.imgSrc) || !p.imgSrc[0]) return [];
      return [{
        img: makeProxyUrl(p.productID, p.imgSrc[0]),
        votes: p.votes || 0
      }];
    });

  if (!pool.length) {
    container.textContent = "No product images available.";
    return;
  }

  // sort by votes descending, take top 20
  let top20 = pool
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 20);

  // **shuffle** to randomize display order
  top20 = shuffleArray(top20);

  // render them, pairing each with one fake review
  top20.forEach((pick, i) => {
    const fake = fakeTestimonials[i % fakeTestimonials.length];
    container.appendChild(createTestimonialCard({
      name:   fake.name,
      review: fake.review,
      imgSrc: pick.img,
      votes:  pick.votes
    }));
  });
}