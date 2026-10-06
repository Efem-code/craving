/* Craving content. The cuisine list drives the wheel, the "Help me decide"
   quiz and the what-to-order cards.

   price: the price levels a cuisine commonly spans (1 = $ … 4 = $$$$).
   Quiz traits are 0–2: comfort, fresh (healthy/light), spicy, quick,
   share (good for groups), date (nice sit-down). */

const PRICES = [
  { lvl: 1, label: '$', name: 'Cheap eats', range: 'under $15 a person' },
  { lvl: 2, label: '$$', name: 'Casual', range: '$15–30 a person' },
  { lvl: 3, label: '$$$', name: 'Nice night out', range: '$30–60 a person' },
  { lvl: 4, label: '$$$$', name: 'Splurge', range: '$60+ a person' },
];

const STYLES = [
  { id: 'dine', emoji: '🪑', label: 'Dine in' },
  { id: 'take', emoji: '🥡', label: 'Takeout' },
  { id: 'deliv', emoji: '🛵', label: 'Delivery' },
  { id: 'drive', emoji: '🚗', label: 'Drive-thru', off: true },
  { id: 'home', emoji: '🏠', label: 'Cook at home', off: true },
];

const CUISINES = [
  { id: 'pizza', emoji: '🍕', name: 'Pizza', price: [1, 2], comfort: 2, fresh: 0, spicy: 0, quick: 2, share: 2, date: 0,
    order: ['Margherita or a beef pepperoni (ask — most pepperoni is pork)', 'Garlic knots', 'A big side salad to balance it'], q: 'pizza' },
  { id: 'burgers', emoji: '🍔', name: 'Burgers', price: [1, 2], comfort: 2, fresh: 0, spicy: 0, quick: 2, share: 1, date: 0,
    order: ['Classic smash burger', 'Sweet potato fries', 'A milkshake if it is that kind of day'], q: 'burgers' },
  { id: 'sushi', emoji: '🍣', name: 'Sushi', price: [2, 3, 4], comfort: 1, fresh: 2, spicy: 0, quick: 1, share: 2, date: 2,
    order: ['Salmon or tuna sashimi', 'A chef’s roll', 'Miso soup and seaweed salad', 'Omakase if you are splurging'], q: 'sushi' },
  { id: 'ramen', emoji: '🍜', name: 'Ramen', price: [2], comfort: 2, fresh: 0, spicy: 1, quick: 1, share: 0, date: 1,
    order: ['Chicken paitan (creamy chicken broth)', 'Spicy miso — ask if the broth is pork-based', 'Add a soft egg', 'Veggie or chicken gyoza'], q: 'ramen' },
  { id: 'chinese', emoji: '🥡', name: 'Chinese', price: [1, 2, 3], comfort: 2, fresh: 1, spicy: 1, quick: 2, share: 2, date: 0,
    order: ['Garlic green beans', 'Kung pao chicken', 'Salt and pepper squid', 'Fried rice to share'], q: 'chinese food' },
  { id: 'dimsum', emoji: '🥟', name: 'Dim Sum', price: [2], comfort: 2, fresh: 1, spicy: 0, quick: 1, share: 2, date: 1,
    order: ['Har gow (shrimp dumplings)', 'Shrimp rice rolls (cheung fun)', 'Custard buns', 'Egg tarts — many dim sum items hide pork, so ask'], q: 'dim sum' },
  { id: 'thai', emoji: '🌶️', name: 'Thai', price: [1, 2], comfort: 1, fresh: 1, spicy: 2, quick: 2, share: 2, date: 1,
    order: ['Pad see ew or pad thai', 'Green or panang curry', 'Tom yum soup', 'Mango sticky rice'], q: 'thai food' },
  { id: 'viet', emoji: '🍲', name: 'Vietnamese', short: 'Pho', price: [1, 2], comfort: 2, fresh: 2, spicy: 1, quick: 2, share: 1, date: 0,
    order: ['Pho (rare beef or chicken)', 'Lemongrass chicken bánh mì', 'Shrimp salad rolls', 'Lemongrass chicken vermicelli bowl'], q: 'vietnamese pho' },
  { id: 'korean', emoji: '🥩', name: 'Korean BBQ', short: 'Korean', price: [2, 3], comfort: 1, fresh: 1, spicy: 1, quick: 0, share: 2, date: 2,
    order: ['Galbi (marinated short rib)', 'Chadol (thin beef brisket)', 'Bibimbap in a stone bowl', 'All the banchan'], q: 'korean bbq' },
  { id: 'indian', emoji: '🍛', name: 'Indian', price: [1, 2], comfort: 2, fresh: 1, spicy: 2, quick: 1, share: 2, date: 1,
    order: ['Butter chicken or chana masala', 'Garlic naan', 'Tandoori chicken', 'Mango lassi'], q: 'indian food' },
  { id: 'mexican', emoji: '🌮', name: 'Mexican', price: [1, 2], comfort: 2, fresh: 1, spicy: 2, quick: 2, share: 2, date: 1,
    order: ['Carne asada or fish tacos', 'Burrito bowl', 'Guac and chips', 'Elote (street corn)'], q: 'mexican food tacos' },
  { id: 'greek', emoji: '🥙', name: 'Greek', price: [1, 2], comfort: 1, fresh: 2, spicy: 0, quick: 2, share: 2, date: 1,
    order: ['Chicken souvlaki plate', 'Spanakopita', 'Greek salad', 'Tzatziki and pita'], q: 'greek food' },
  { id: 'mideast', emoji: '🧆', name: 'Middle Eastern', short: 'Shawarma', price: [1, 2], comfort: 1, fresh: 2, spicy: 1, quick: 2, share: 2, date: 0,
    order: ['Chicken shawarma plate', 'Falafel wrap', 'Hummus and baba ganoush', 'Fattoush salad'], q: 'shawarma middle eastern' },
  { id: 'persian', emoji: '🍢', name: 'Persian', price: [2], comfort: 2, fresh: 1, spicy: 0, quick: 1, share: 2, date: 1,
    order: ['Koobideh kabob with saffron rice', 'Joojeh (saffron chicken)', 'Ghormeh sabzi', 'Tahdig if they have it'], q: 'persian food' },
  { id: 'italian', emoji: '🍝', name: 'Italian', price: [2, 3], comfort: 2, fresh: 1, spicy: 0, quick: 0, share: 1, date: 2,
    order: ['Fresh pasta (cacio e pepe, pesto)', 'Burrata', 'Risotto', 'Tiramisu'], q: 'italian restaurant' },
  { id: 'chicken', emoji: '🍗', name: 'Fried Chicken', short: 'Chicken', price: [1], comfort: 2, fresh: 0, spicy: 1, quick: 2, share: 2, date: 0,
    order: ['Korean fried chicken (half and half)', 'Nashville hot sandwich', 'Coleslaw', 'Pickled radish'], q: 'fried chicken' },
  { id: 'bbq', emoji: '🍖', name: 'Smokehouse BBQ', short: 'BBQ', price: [2], comfort: 2, fresh: 0, spicy: 1, quick: 1, share: 2, date: 0,
    order: ['Beef brisket', 'Smoked chicken', 'Mac and cheese', 'Cornbread'], q: 'bbq smokehouse' },
  { id: 'seafood', emoji: '🦞', name: 'Seafood', price: [2, 3, 4], comfort: 1, fresh: 2, spicy: 0, quick: 0, share: 2, date: 2,
    order: ['Fish and chips (halibut or cod)', 'Oysters', 'Seafood chowder', 'Grilled salmon'], q: 'seafood restaurant' },
  { id: 'steak', emoji: '🥩', name: 'Steakhouse', short: 'Steak', price: [3, 4], comfort: 2, fresh: 0, spicy: 0, quick: 0, share: 1, date: 2,
    order: ['Ribeye or striploin, medium-rare', 'Caesar salad (no bacon)', 'Roasted mushrooms', 'Something chocolate'], q: 'steakhouse' },
  { id: 'brunch', emoji: '🥞', name: 'Brunch', price: [1, 2], comfort: 2, fresh: 1, spicy: 0, quick: 1, share: 1, date: 1,
    order: ['Eggs benny with smoked salmon', 'Breakfast burrito', 'Pancakes for the table', 'Good coffee'], q: 'brunch' },
  { id: 'bowls', emoji: '🥗', name: 'Poke & Bowls', short: 'Poke', price: [1, 2], comfort: 0, fresh: 2, spicy: 1, quick: 2, share: 0, date: 0,
    order: ['Salmon poke with brown rice', 'Grain bowl with chicken', 'Extra greens, sauce on the side'], q: 'poke bowl' },
  { id: 'deli', emoji: '🥪', name: 'Sandwiches', short: 'Deli', price: [1], comfort: 1, fresh: 1, spicy: 0, quick: 2, share: 0, date: 0,
    order: ['Chicken pesto panini', 'Roast turkey on sourdough', 'Soup and half sandwich'], q: 'sandwich deli' },
  { id: 'filipino', emoji: '🍚', name: 'Filipino', price: [1, 2], comfort: 2, fresh: 0, spicy: 0, quick: 1, share: 2, date: 0,
    order: ['Chicken adobo', 'Chicken inasal', 'Pancit', 'Halo-halo for dessert'], q: 'filipino food' },
  { id: 'caribbean', emoji: '🥥', name: 'Caribbean', price: [1, 2], comfort: 2, fresh: 1, spicy: 2, quick: 1, share: 1, date: 0,
    order: ['Jerk chicken', 'Oxtail with rice and peas', 'Roti', 'Fried plantain'], q: 'caribbean jamaican food' },
  { id: 'ethiopian', emoji: '🫓', name: 'Ethiopian', short: 'Ethiopian', price: [2], comfort: 2, fresh: 1, spicy: 2, quick: 0, share: 2, date: 2,
    order: ['Veggie combo on injera', 'Doro wat', 'Tibs', 'Eat with your hands'], q: 'ethiopian food' },
  { id: 'french', emoji: '🥐', name: 'French Bistro', short: 'French', price: [3, 4], comfort: 1, fresh: 1, spicy: 0, quick: 0, share: 0, date: 2,
    order: ['Steak frites', 'French onion soup', 'Moules (mussels)', 'Crème brûlée'], q: 'french bistro' },
];

/* "Help me decide" quiz. Each answer adds weight to traits; `price` filters. */
const QUIZ = [
  { id: 'mood', q: 'What are you in the mood for?', a: [
    { t: '🛋️ Comfort food', w: { comfort: 3 } },
    { t: '🥗 Fresh & light', w: { fresh: 3 } },
    { t: '🧭 Something different', w: { novel: 3 } },
    { t: '⚡ Just fast', w: { quick: 3 } }] },
  { id: 'price', q: 'Budget?', a: [
    { t: '$ Cheap', price: 1 }, { t: '$$ Casual', price: 2 }, { t: '$$$ Nice', price: 3 }, { t: '🤷 Doesn’t matter', price: 0 }] },
  { id: 'spice', q: 'How about spice?', a: [
    { t: '🧊 No heat', w: { spicy: -3 } }, { t: '🌶️ A little', w: { spicy: 1 } }, { t: '🔥 Bring it', w: { spicy: 3 } }] },
  { id: 'who', q: 'Who’s eating?', a: [
    { t: '🙋 Just me', w: { quick: 1 } }, { t: '💕 Date', w: { date: 3 } }, { t: '👨‍👩‍👧 Group / family', w: { share: 3 } }] },
];
