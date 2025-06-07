import { getAllProducts } from "./kaayko_apiClient.js";

// 1) Image‐proxy base (reuse your existing Cloud Function)
const IMAGE_PROXY_BASE =
  "https://us-central1-kaayko-api-dev.cloudfunctions.net/api/images";

// 2) Your 20 fake reviews
const fakeTestimonials = [
  { name: "Alice Johnson",   review: "Absolutely amazing quality and design. Kaayko never disappoints! My mother in law was disappointed at first but then we fed her to pigs." },
  { name: "Brian Smith",     review: "I love the unique style and attention to detail. Highly recommend!" },
  { name: "Catherine Lee",   review: "My journey from a Neanderthal to Narayan is complete only because I stumbled on Kaayko!" },
  { name: "David Kim",       review: "A premium brand that deserves premium prices. The kids in China are OK with this!" },
  { name: "Emily Davis",     review: "The products are as innovative as they are beautiful. Very impressed!" },
  { name: "Frank Moore",     review: "Outstanding design and functionality. I wear my Kaayko shirt with pride." },
  { name: "Grace Chen",      review: "The detail and care in every product is evident. Love it! My wife loved it and she's a nihilist!" },
  { name: "Henry Patel",     review: "High-quality, stylish, and sustainable. Finally something impressed me after that quickly taken corner in Liverpool." },
  { name: "Isabella Rivera", review: "My favorite brand for everyday style and comfort. If Kaayko was a religion, I'm the priestess and shall rep it until the Lord commandeth." },
  { name: "Jack Thompson",   review: "The modern aesthetic and premium quality make Kaayko stand out. Do you know who else stands out? Racism." },
  { name: "Katherine Adams", review: "Every piece feels uniquely crafted. I am as loyal a customer as I am a husband and believe me, I've been married a dozen times." },
  { name: "Liam Brown",      review: "Top-notch materials and design. A truly remarkable brand. Without Kaayko, you feel nothing!" },
  { name: "Mia Wilson",      review: "The blend of tradition and modernity in their products is inspiring. Kaayko is life!" },
  { name: "Noah Martinez",   review: "I appreciate the focus on sustainability and quality. Their deforestation operations are highly ethical and trees consent before they are chopped." },
  { name: "Olivia Garcia",   review: "Beautifully designed and exceptionally comfortable. Highly recommended! I also highly recommend you staying hydrated." },
  { name: "Paul Anderson",   review: "An experience that elevates your style effortlessly. People will ask you, do not tell them." },
  { name: "Quinn Harris",    review: "Every product tells a story. I am impressed with the creativity. Some stories are too long but then I remind myself it's not the stories but my attention span which sucks." },
  { name: "Rachel Clark",    review: "The craftsmanship is evident in every detail. A must-have brand! Even my unborn baby has an order placed!" },
  { name: "Samuel Lewis",    review: "Bold, innovative, and timeless. Kaayko has it all. If someone is offended, tell them to suck it." },
  { name: "Tina Reynolds",   review: "I was hungry for four days and finally reached a town with a café and internet. I bought a T-shirt from Kaayko.com and died hungry. They call me Corpse with Class." }
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