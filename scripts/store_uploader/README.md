# Kaayko Store Uploader

Drop product images into a folder, run one command, watch them appear on `kaayko.com/store`.

## What it does

1. Scans a folder for `<Name>_<Type>[_<index>].<png|jpg|webp>` files.
2. Groups files into products (multi-image SKUs share a name+type prefix).
3. Upscales each image to ~2400px on the long edge (Lanczos resampling) and re-encodes as WebP at q=92.
4. Uploads WebPs to Firebase Storage at `kaaykoStoreTShirtImages/<productID>/`.
5. Upserts a Firestore doc in `kaaykoproducts` (idempotent — re-runs overwrite cleanly).

Recognized `<Type>` tokens: `tote`, `magnet`, `tshirt`, `print`, `sticker`, `mug`, `cap`, `poster`.

## Setup (one time)

```bash
cd /Users/Rohan/Kaayko_v6
.venv/bin/pip install -r kaayko/scripts/store_uploader/requirements.txt
cp kaayko/scripts/store_uploader/.env.example kaayko/scripts/store_uploader/.env
# edit .env if the service-account path differs
```

The default service-account path is `/Users/Rohan/Desktop/Kaayko_TShirts_v2/key/store_key.json`.

## Use

```bash
cd /Users/Rohan/Kaayko_v6/kaayko/scripts/store_uploader

# Preview only
../../../.venv/bin/python store_upload.py /Users/Rohan/Desktop/Kaayko_Tote --dry-run

# Real upload
../../../.venv/bin/python store_upload.py /Users/Rohan/Desktop/Kaayko_Tote

# Only one product
../../../.venv/bin/python store_upload.py /Users/Rohan/Desktop/Kaayko_Tote --only Blackbuck_Tote
```

## Adding new products in the future

Three steps:

1. Drop new images into a folder, following the `<Name>_<Type>_<index>.png` convention.
   ```
   /Users/Rohan/Desktop/Kaayko_TShirts_Q3/
     IndianTiger_Tshirt_1.png
     IndianTiger_Tshirt_2.png
     IndianTiger_Tshirt_3.png
     Komodo_Magnet.png
   ```

2. *(Optional)* drop a `manifest.yaml` in the same folder to override titles, prices, descriptions. See `manifest.example.yaml`. Without one, each product gets type-default pricing and an auto-generated placeholder title/description you can edit in Firestore later.

3. Run:
   ```bash
   python store_upload.py /Users/Rohan/Desktop/Kaayko_TShirts_Q3 --dry-run
   python store_upload.py /Users/Rohan/Desktop/Kaayko_TShirts_Q3
   ```

The Firestore productID is derived deterministically from name+type, so re-running an upload modifies the existing SKU in place. Safe to iterate.

## Schema written to Firestore (`kaaykoproducts/{productID}`)

```js
{
  productID:       "kaayko_blackbuck_tote",
  title:           "Blackbuck Tote",
  description:     "...",
  actualPrice:     34.99,
  price:           "$$",         // symbol derived from actualPrice
  productType:     "tote",        // NEW — drives store category sections
  category:        "accessories",  // existing kreator category vocab
  tags:            [...],
  availableSizes:  ["One Size"],
  availableColors: [],
  maxQuantity:     50,
  stockQuantity:   50,
  isAvailable:     true,
  imgSrc:          ["https://storage.googleapis.com/.../0.webp", ...],
  votes:           0,             // only set on first create
  createdAt:       Timestamp,     // only set on first create
  updatedAt:       Timestamp,
}
```

## Notes

- The `/api/products` endpoint re-derives `imgSrc` from Storage on every request, so what matters most is the Storage objects. The Firestore `imgSrc` field is written for completeness and as a fallback.
- WebP encoding uses `method=6` (slowest, best compression). A 10-image upload takes ~30 seconds total on a modern Mac.
- Existing T-shirt records without a `productType` field still render — they land in the "Other" section on the store page.
