import { getAllProducts } from "./kaayko_apiClient.js";

// 1) Point at your existing image‐proxy function:
const IMAGE_PROXY_BASE =
  "https://us-central1-kaayko-api-dev.cloudfunctions.net/api/images";

// ─────────────────────────────────────────────────────────────────
// 1) All 20 fake reviews live here now (no more about.js)
// ─────────────────────────────────────────────────────────────────
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

/** Extract the raw filename from a signed URL */
function extractFileName(signedUrl) {
  const url = new URL(signedUrl);
  // url.pathname ends with "...%2F<folder>%2F<fileName>"
  const parts = url.pathname.split("%2F");
  return parts[parts.length - 1]; // e.g. "tBone1.png"
}

/** Build the same proxy URL your carousel uses */
function makeProxyUrl(productID, signedUrl) {
  const fileName = extractFileName(signedUrl);
  return `${IMAGE_PROXY_BASE}/` +
         `${encodeURIComponent(productID)}/` +
         `${encodeURIComponent(fileName)}`;
}

/** Creates one testimonial card */
/** Creates one testimonial card */
function createTestimonialCard({ name, review, imgSrc, votes }) {
  const card = document.createElement("div");
  card.className = "testimonial";

  // 1) Avatar circle
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  if (imgSrc) {
    const img = document.createElement("img");
    img.src = imgSrc;
    img.alt = name;
    avatar.appendChild(img);
  }

  // 2) Vote badge
  const badge = document.createElement("div");
  badge.className = "avatar-votes";
  badge.textContent = `⭐ ${votes}`;

  // NEW: wrapper to stack them
  const avatarWrapper = document.createElement("div");
  avatarWrapper.className = "avatar-wrapper";
  avatarWrapper.append(avatar, badge);

  // 3) Text content
  const content = document.createElement("div");
  content.className = "testimonial-content";
  const p = document.createElement("p");
  p.textContent = review;
  const who = document.createElement("span");
  who.className = "name";
  who.textContent = name;
  content.append(p, who);

  // 4) Put it all together
  card.append(avatarWrapper, content);
  return card;
}

/**
 * Fetch & render all 20 fakeTestimonials,
 * pairing each with a random product-image & vote count.
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

  // Build a pool of { img: proxyUrl, votes }
  const pool = products.flatMap(p => {
    if (!Array.isArray(p.imgSrc) || !p.imgSrc[0]) return [];
    const proxy = makeProxyUrl(p.productID, p.imgSrc[0]);
    return [{ img: proxy, votes: p.votes || 0 }];
  });

  if (!pool.length) {
    container.textContent = "No product images available.";
    return;
  }

  // Shuffle and render
  shuffleArray(fakeTestimonials.slice())
    .forEach(r => {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      container.appendChild(
        createTestimonialCard({
          name:   r.name,
          review: r.review,
          imgSrc: pick.img,
          votes:  pick.votes
        })
      );
    });
}