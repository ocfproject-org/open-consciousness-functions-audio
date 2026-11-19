/* Public reflection library. Stable IDs are retained, including archived starters. */
((root) => {
  'use strict';
  const groups = [
    ['letting-go', 'Letting go & beliefs', ['I can question a familiar belief without judging my past self.', 'I make room for what matters by releasing one small burden.', 'A change of mind can be a thoughtful choice.']],
    ['self-kindness', 'Self-kindness & body respect', ['My body deserves ordinary care, even on difficult days.', 'I can speak to myself with the patience I offer a friend.', 'Rest belongs in my plans, not just after them.']],
    ['confidence', 'Confidence & boundaries', ['I can give a clear answer without a long apology.', 'My boundaries can be kind and firm at once.', 'I can take a small brave step while feeling uncertain.']],
    ['calm', 'Calm & steadiness', ['This moment does not require every answer.', 'I can pause before choosing my next response.', 'I give one thing my attention and let the rest wait.']],
    ['purpose', 'Purpose & values', ['A useful day can begin with one deliberate choice.', 'I can choose a direction without knowing the whole route.', 'Small choices can express what I care about.']],
    ['gratitude', 'Gratitude & opportunity', ['I notice one ordinary thing that supports my day.', 'I can appreciate what is here and still want change.', 'I stay curious about an invitation I might otherwise miss.']],
    ['connection', 'Love & friendship', ['I can offer attention without trying to fix everything.', 'I make room for relationships where care moves both ways.', 'A small honest conversation can bring us closer.']],
    ['creativity', 'Creativity', ['A rough first attempt gives my ideas somewhere to begin.', 'I can play with an idea before deciding whether it works.', 'My curiosity deserves a little space today.']],
    ['follow-through', 'Motivation & follow-through', ['I can make the next step small enough to start.', 'Returning to a task counts, even after an interruption.', 'I choose a workable pace over an impressive promise.']],
    ['learning', 'Learning & focus', ['Not knowing yet leaves room to learn.', 'I can ask a precise question when I feel stuck.', 'One focused interval is a worthwhile beginning.']],
    ['work', 'Work & teamwork', ['I can make my needs and next steps clear to my team.', 'Listening carefully can be a useful contribution.', 'I can ask for help before a problem grows.']],
    ['perspective', 'Perspective & everyday choices', ['A difficult moment is part of my day, not its whole story.', 'I can choose what deserves my energy next.', 'I leave room in my plans for being human.']],
  ];
  const publicLines = [
  {
    "id": "public:p-25d4e584fcd6de5e7c17",
    "category": "letting-go",
    "text": "I am now releasing my past."
  },
  {
    "id": "public:p-2e0c191590b63fbe908c",
    "category": "letting-go",
    "text": "I am now dissolving all negative, limiting beliefs."
  },
  {
    "id": "public:p-d1f3a40f35d0dbd59603",
    "category": "letting-go",
    "text": "I now forgive and release everyone in my life."
  },
  {
    "id": "public:p-517d33eac17603b8999e",
    "category": "letting-go",
    "text": "I don’t have to try to please others."
  },
  {
    "id": "public:p-9fa71db319787af6522e",
    "category": "letting-go",
    "text": "I am naturally lovable and likable no matter what I do!"
  },
  {
    "id": "public:p-17572a3f3c9a94267642",
    "category": "letting-go",
    "text": "I now let go of all accumulated guilt, fears, resentment, disappointments, and grudges."
  },
  {
    "id": "public:p-67a53309ebe190bb23b1",
    "category": "letting-go",
    "text": "I am free and clear! All of my negative self-images and attitudes are now dissolved."
  },
  {
    "id": "public:p-770e479a8036fc703e86",
    "category": "letting-go",
    "text": "I love and appreciate myself!"
  },
  {
    "id": "public:p-512fe03d3cbb855f3518",
    "category": "letting-go",
    "text": "All barriers to my full expression and enjoyment of life are now dissolved."
  },
  {
    "id": "public:p-3b14e01055df540e015a",
    "category": "letting-go",
    "text": "The world is a beautiful place to be."
  },
  {
    "id": "public:p-9eeb6d468dd0722bfbbc",
    "category": "letting-go",
    "text": "The universe always provides."
  },
  {
    "id": "public:p-2590ecbfd368de7aa440",
    "category": "self-kindness",
    "text": "Every day I am growing healthier and more attractive."
  },
  {
    "id": "public:p-8c535882dc080fdada25",
    "category": "self-kindness",
    "text": "Everything I do adds to my health and beauty."
  },
  {
    "id": "public:p-6120a8bd36ab884a6733",
    "category": "self-kindness",
    "text": "Everything I eat adds to my health, beauty, and attractiveness."
  },
  {
    "id": "public:p-f81c00f85f4957ec7540",
    "category": "self-kindness",
    "text": "I am good to my body, and my body is good to me."
  },
  {
    "id": "public:p-cb3ca34e868d62acfb75",
    "category": "self-kindness",
    "text": "I am now slender, strong, and in perfect condition no matter what I do."
  },
  {
    "id": "public:p-cc97b614c67f8f3dee49",
    "category": "self-kindness",
    "text": "I am growing stronger and more powerful every day."
  },
  {
    "id": "public:p-6072cc063e3d807e9408",
    "category": "self-kindness",
    "text": "I now desire to eat only those things that are best for me at any given time."
  },
  {
    "id": "public:p-8f6d9585c477d10c6551",
    "category": "self-kindness",
    "text": "I get hungry only for the foods my body really needs."
  },
  {
    "id": "public:p-cb1b097873f1442f9c35",
    "category": "self-kindness",
    "text": "The more I love and appreciate myself, the more beautiful I am becoming."
  },
  {
    "id": "public:p-b84f9eb98c66bff1adc6",
    "category": "self-kindness",
    "text": "I am now irresistibly attractive to men (or women)."
  },
  {
    "id": "public:p-a6355a729281205a1395",
    "category": "self-kindness",
    "text": "I love my body as it is. I am naturally attractive as I am."
  },
  {
    "id": "public:p-4b3ff4b94f392037ce14",
    "category": "purpose",
    "text": "By the practice of this meditation My whole body is vibrant with robust good health My life is richly imbued with happiness and purpose For the sake of my family, friends and all living beings."
  },
  {
    "id": "public:p-cc1e98281d84ca3484c1",
    "category": "self-kindness",
    "text": "Today I love my body fully, deeply and joyfully."
  },
  {
    "id": "public:p-73137b131951b0332602",
    "category": "self-kindness",
    "text": "My body has its own wisdom and I trust that wisdom completely."
  },
  {
    "id": "public:p-8d1e206e8b417fd4e7d8",
    "category": "self-kindness",
    "text": "My body is simply a projection of my beliefs about myself."
  },
  {
    "id": "public:p-43e60d05a3f265ea8fc8",
    "category": "self-kindness",
    "text": "I am growing more beautiful and luminous day by day."
  },
  {
    "id": "public:p-401f2fddb50c5c63c883",
    "category": "self-kindness",
    "text": "I choose to see the divine perfection in every cell of my body."
  },
  {
    "id": "public:p-617cd7fbf3bfd0e4e43d",
    "category": "self-kindness",
    "text": "As I love myself, I allow others to love me too."
  },
  {
    "id": "public:p-c86d086c4a2b1dd18b1f",
    "category": "self-kindness",
    "text": "Flaws are transformed by love and acceptance."
  },
  {
    "id": "public:p-7ec531ed4063b3bdf0ce",
    "category": "self-kindness",
    "text": "Today I choose to honor my beauty, my strength and my uniqueness."
  },
  {
    "id": "public:p-48e3f93daf6ededf8575",
    "category": "self-kindness",
    "text": "I love the way I feel when I take good care of myself."
  },
  {
    "id": "public:p-b53802b6757b1646c753",
    "category": "self-kindness",
    "text": "Today my own well-being is my top priority."
  },
  {
    "id": "public:p-71cd9a21237872b37d0a",
    "category": "confidence",
    "text": "Fear is only a feeling; it cannot hold me back."
  },
  {
    "id": "public:p-70606b581b03883656ae",
    "category": "confidence",
    "text": "I know that I can master anything if I do it enough times."
  },
  {
    "id": "public:p-ff1dfdb5f942fdee118a",
    "category": "confidence",
    "text": "Today I am willing to fail in order to succeed."
  },
  {
    "id": "public:p-855abbf3c3f51f95f167",
    "category": "confidence",
    "text": "I believe that I have the strength to make my dreams come true."
  },
  {
    "id": "public:p-810297186b62c360ae38",
    "category": "confidence",
    "text": "I'm going to relax and have fun with this, no matter what the outcome may be."
  },
  {
    "id": "public:p-9a46c3c4c2c53f234a68",
    "category": "confidence",
    "text": "I'm proud of myself for even daring to try; many people won't even do that!"
  },
  {
    "id": "public:p-5f52d07cb5c75cfaccae",
    "category": "confidence",
    "text": "Today I put my full trust in my inner guidance."
  },
  {
    "id": "public:p-a4477880b05ef3f2a6b9",
    "category": "confidence",
    "text": "I grow in strength with every forward step I take."
  },
  {
    "id": "public:p-027adb8799347f4b4669",
    "category": "confidence",
    "text": "I release my hesitation and make room for victory!"
  },
  {
    "id": "public:p-2409d0aacef443e64e22",
    "category": "confidence",
    "text": "With a solid plan and a belief in myself, there's nothing I can't do."
  },
  {
    "id": "public:p-9cf5918447c047e3040f",
    "category": "gratitude",
    "text": "I open to the flow of great abundance in all areas of my life."
  },
  {
    "id": "public:p-2d4cff40c8eaf81f012b",
    "category": "gratitude",
    "text": "I always have more than enough of everything I need."
  },
  {
    "id": "public:p-46443a191a3610fd9bac",
    "category": "gratitude",
    "text": "Thank you, thank you, thank you, thank you!"
  },
  {
    "id": "public:p-826e8056455b2514a1af",
    "category": "gratitude",
    "text": "Today I expand my awareness of the abundance all around me."
  },
  {
    "id": "public:p-bcec3b891a4e6ae90f72",
    "category": "gratitude",
    "text": "I allow the universe to bless me in surprising and joyful ways."
  },
  {
    "id": "public:p-27fdfd03e09f80d855d6",
    "category": "gratitude",
    "text": "My grateful heart is a magnet that attracts more of everything I desire."
  },
  {
    "id": "public:p-c4cade1afffc40dd31b9",
    "category": "gratitude",
    "text": "Prosperity surrounds me, prosperity fills me, prosperity flows to me and through me."
  },
  {
    "id": "public:p-d44d743754a7b3ba4ee3",
    "category": "gratitude",
    "text": "I exude passion, purpose and prosperity."
  },
  {
    "id": "public:p-ad836857eea3528bedf7",
    "category": "gratitude",
    "text": "I am always led to the people who need what I have to offer."
  },
  {
    "id": "public:p-7620effb4eca0ce044c5",
    "category": "gratitude",
    "text": "As my commitment to help others grows, so does my wealth."
  },
  {
    "id": "public:p-dfe13657342ba8153511",
    "category": "gratitude",
    "text": "My day is filled with limitless potential in joy, abundance and love."
  },
  {
    "id": "public:p-a0b61794961f766f8744",
    "category": "purpose",
    "text": "The better I know myself, the clearer my purpose becomes."
  },
  {
    "id": "public:p-5b1a4c2bd3656a8b909f",
    "category": "purpose",
    "text": "My unique skills and talents can make a profound difference in the world."
  },
  {
    "id": "public:p-753521af003615aecad6",
    "category": "purpose",
    "text": "Today I follow my heart and discover my destiny."
  },
  {
    "id": "public:p-f64369682433bd6cf376",
    "category": "purpose",
    "text": "I am meant to do great things."
  },
  {
    "id": "public:p-f2efe9ae827319ed0602",
    "category": "purpose",
    "text": "I am limited only by my vision of what is possible."
  },
  {
    "id": "public:p-8d08cbb8b29ace4a153e",
    "category": "purpose",
    "text": "My purpose is to develop and share the best parts of myself with others."
  },
  {
    "id": "public:p-b317041867a56daedea0",
    "category": "purpose",
    "text": "Today I present my love, passion, talent and joy as a gift to the world."
  },
  {
    "id": "public:p-91fb2206517585c0be09",
    "category": "purpose",
    "text": "I need not know the entire journey in order to take one step."
  },
  {
    "id": "public:p-1e0d7a564e86ef5d7fc0",
    "category": "purpose",
    "text": "I fulfill my life purpose by starting here, right now."
  },
  {
    "id": "public:p-e420e9e291df581c4f7b",
    "category": "purpose",
    "text": "My life purpose can be whatever I decide to make it."
  },
  {
    "id": "public:p-6d2e4420084cc95d5132",
    "category": "calm",
    "text": "All is well, right here, right now."
  },
  {
    "id": "public:p-b7802cc255cc71e7f411",
    "category": "calm",
    "text": "Peace begins with a conscious choice."
  },
  {
    "id": "public:p-f993c358eb72d69e91c2",
    "category": "calm",
    "text": "Today I embrace simplicity, peace and solace."
  },
  {
    "id": "public:p-5ba1b57e44de108bf388",
    "category": "calm",
    "text": "A peaceful heart makes for a peaceful life."
  },
  {
    "id": "public:p-fdc826e9585f66324ec7",
    "category": "calm",
    "text": "I trust the universe to deliver my highest good in every situation."
  },
  {
    "id": "public:p-ae21f606f2ab33a86e1e",
    "category": "calm",
    "text": "By becoming peace, I create peace in every experience."
  },
  {
    "id": "public:p-a86ba8f6e06c3c9cb3ff",
    "category": "calm",
    "text": "I am filled with the light of love, peace and joy."
  },
  {
    "id": "public:p-dc2b2801654e2618083b",
    "category": "calm",
    "text": "Peace comes when I let go of trying to control every tiny detail."
  },
  {
    "id": "public:p-fc037c6c835207a9cc64",
    "category": "calm",
    "text": "Where peace dwells, fear cannot."
  },
  {
    "id": "public:p-c90f79f2339a9b077444",
    "category": "calm",
    "text": "Today my mission is to surrender and release."
  },
  {
    "id": "public:p-739018d05040e6176385",
    "category": "calm",
    "text": "The Love of God is flowing through me now."
  },
  {
    "id": "public:p-585a42344d0f8a60f7d0",
    "category": "calm",
    "text": "I am a radiant being filled with light and love."
  },
  {
    "id": "public:p-ccf102586bfde33a788e",
    "category": "calm",
    "text": "I give love this day to everyone I meet."
  },
  {
    "id": "public:p-ebf6f6b48353d177d6a2",
    "category": "calm",
    "text": "I am pure love."
  },
  {
    "id": "public:p-d4b342cdf3f738d8a8cf",
    "category": "calm",
    "text": "I rest in the sacred place within, which is my soul."
  },
  {
    "id": "public:p-5c5d0d7263b34063c048",
    "category": "calm",
    "text": "I am open to receive the abundance of this day."
  },
  {
    "id": "public:p-09c7d11bda2e531140cf",
    "category": "calm",
    "text": "The light of God is within me now."
  },
  {
    "id": "public:p-42f2fcad47a426eb8988",
    "category": "calm",
    "text": "I am now send love and compassion out into the world."
  },
  {
    "id": "public:p-f389aefcf42d4cb7cf56",
    "category": "calm",
    "text": "I am centered and calm at all times."
  },
  {
    "id": "public:p-cca3ef3fb1b8deed5bd6",
    "category": "calm",
    "text": "Life is good."
  },
  {
    "id": "public:p-d6a73bbe39cca76fd069",
    "category": "gratitude",
    "text": "Today I open my mind to the endless opportunities surrounding me."
  },
  {
    "id": "public:p-dbef20cba73852328acb",
    "category": "gratitude",
    "text": "Opportunities are everywhere, if I choose to see them."
  },
  {
    "id": "public:p-7dbe9eeab3b6e351c9bd",
    "category": "gratitude",
    "text": "I boldly act on great opportunities when I see them."
  },
  {
    "id": "public:p-05725f6084a5d3d1a9dd",
    "category": "gratitude",
    "text": "My intuition leads me to the most lucrative opportunities."
  },
  {
    "id": "public:p-bc28fec3dbfedbbb865c",
    "category": "gratitude",
    "text": "An opportunity is simply a possibility until I act on it."
  },
  {
    "id": "public:p-6a306600b572c81f765e",
    "category": "gratitude",
    "text": "Some of the best opportunities are made, not found."
  },
  {
    "id": "public:p-e6eafebc1a31adf3198e",
    "category": "gratitude",
    "text": "Today I see each moment as a new opportunity to express my greatness."
  },
  {
    "id": "public:p-f4600527ccd38dc7f34e",
    "category": "gratitude",
    "text": "I expand my awareness of the hidden potential in each experience."
  },
  {
    "id": "public:p-3cece90509ccf31028f6",
    "category": "gratitude",
    "text": "Let each of my experiences today be a gateway to something even better."
  },
  {
    "id": "public:p-cba889257f8734aac1d0",
    "category": "gratitude",
    "text": "Each decision I make creates new opportunities."
  },
  {
    "id": "public:p-482924a73595112ec329",
    "category": "connection",
    "text": "I am ready for a healthy, loving relationship."
  },
  {
    "id": "public:p-80b80475ac120ad98029",
    "category": "connection",
    "text": "All of my relationships are meaningful and fulfilling."
  },
  {
    "id": "public:p-a60a50c77077f85b3b01",
    "category": "connection",
    "text": "As I share my love with others the universe mirrors love back to me."
  },
  {
    "id": "public:p-d1d930f5060598dc1b5b",
    "category": "connection",
    "text": "I see everyone I meet as a soul mate."
  },
  {
    "id": "public:p-29009f09a2e600f7c5a2",
    "category": "connection",
    "text": "I trust the universe to know the type of partner who is perfect for me."
  },
  {
    "id": "public:p-f584e852381f18e93648",
    "category": "connection",
    "text": "Today I release fear and open my heart to true love."
  },
  {
    "id": "public:p-fdf931df3aab20ffe465",
    "category": "connection",
    "text": "I am grateful for the people in my life."
  },
  {
    "id": "public:p-a2a3910c16a75dee57f4",
    "category": "connection",
    "text": "I am the perfect partner for my perfect partner."
  },
  {
    "id": "public:p-8acdc4a037245886685a",
    "category": "connection",
    "text": "I deserve a loving, healthy relationship."
  },
  {
    "id": "public:p-dbaed0906a38d9d4ab57",
    "category": "connection",
    "text": "I deserve to be loved and I allow myself to be loved."
  },
  {
    "id": "public:p-c66e69c6ecadd7bacc29",
    "category": "self-kindness",
    "text": "I am strong and healthy."
  },
  {
    "id": "public:p-5978bfabeca5b821dcad",
    "category": "self-kindness",
    "text": "My energy and vitality are increasing every day."
  },
  {
    "id": "public:p-f38e183a09ad8b788f34",
    "category": "self-kindness",
    "text": "I open to the natural flow of wellness now."
  },
  {
    "id": "public:p-022ab9395f1e93402ba8",
    "category": "self-kindness",
    "text": "My inner guidance leads me to the right healing modalities for me."
  },
  {
    "id": "public:p-2cb1c61b4c07a5b29248",
    "category": "self-kindness",
    "text": "Abundant health and wellness are my birthright."
  },
  {
    "id": "public:p-dba5da0c2e2f1bc92ed3",
    "category": "self-kindness",
    "text": "Thank you for my strength, my health and my vitality."
  },
  {
    "id": "public:p-6c984390808a21574ac1",
    "category": "self-kindness",
    "text": "I am feeling stronger and better now."
  },
  {
    "id": "public:p-2396a633e4585623718a",
    "category": "self-kindness",
    "text": "I love taking good care of myself."
  },
  {
    "id": "public:p-4bcca3adc952b6313dd6",
    "category": "self-kindness",
    "text": "Today nurturing myself is my highest priority."
  },
  {
    "id": "public:p-14d667ca97131d38eb9f",
    "category": "self-kindness",
    "text": "Thank you for the opportunity to balance my mind, body and spirit."
  },
  {
    "id": "public:p-5ca8cf897725510ffe8e",
    "category": "perspective",
    "text": "Today I awaken to my higher wisdom."
  },
  {
    "id": "public:p-a66f92b03db60d8ba3f2",
    "category": "perspective",
    "text": "My inner voice guides me in every moment."
  },
  {
    "id": "public:p-f58b109fba86d4a2a172",
    "category": "perspective",
    "text": "I am centered, calm and clear."
  },
  {
    "id": "public:p-0563e4e011fea5d3a878",
    "category": "perspective",
    "text": "I always know the right actions to achieve my goals."
  },
  {
    "id": "public:p-edf45d553dcf44619d2b",
    "category": "perspective",
    "text": "When I know where I'm going, getting there is a cinch!"
  },
  {
    "id": "public:p-a0e1e8e69545a8a2dba9",
    "category": "perspective",
    "text": "Today I am completely tuned in to my inner wisdom."
  },
  {
    "id": "public:p-e1b9d5ce7621bdbfe29d",
    "category": "perspective",
    "text": "Harmony is always a sign that I am balanced from within."
  },
  {
    "id": "public:p-9277f25e478db84d80cb",
    "category": "perspective",
    "text": "Thank you for showing me the way to my dreams."
  },
  {
    "id": "public:p-030d51dbe1d9c5243bee",
    "category": "perspective",
    "text": "I trust my feelings and insights."
  },
  {
    "id": "public:p-6102e4388f8bab026f89",
    "category": "perspective",
    "text": "I am detached and open to divine guidance."
  },
  {
    "id": "public:p-ff519365c750d79c1f36",
    "category": "self-kindness",
    "text": "I am filled with light, love and peace."
  },
  {
    "id": "public:p-7f0843a30beefaef9683",
    "category": "self-kindness",
    "text": "I treat myself with kindness and respect."
  },
  {
    "id": "public:p-c847e34f7e655509981a",
    "category": "self-kindness",
    "text": "I don't have to be perfect; I just have to be me."
  },
  {
    "id": "public:p-a4b024bc99e33a2160c6",
    "category": "self-kindness",
    "text": "I give myself permission to shine."
  },
  {
    "id": "public:p-4ff07a177dfa22e5ccb1",
    "category": "self-kindness",
    "text": "I honor the best parts of myself and share them with others."
  },
  {
    "id": "public:p-e7854abf089f66cffbb5",
    "category": "self-kindness",
    "text": "I'm proud of all I have accomplished."
  },
  {
    "id": "public:p-7ce8909e88d039d6de3e",
    "category": "self-kindness",
    "text": "Today I give myself permission to be greater than my fears."
  },
  {
    "id": "public:p-ad50e8cb31d89c4b3585",
    "category": "self-kindness",
    "text": "I love myself no matter what."
  },
  {
    "id": "public:p-6ec2775bc03ba55513fd",
    "category": "self-kindness",
    "text": "I am my own best friend and cheerleader."
  },
  {
    "id": "public:p-092ed62e8185afe5bb51",
    "category": "self-kindness",
    "text": "Thank you for the qualities, traits and talents that make me so unique."
  },
  {
    "id": "public:p-5ec723b71409eb32ddb2",
    "category": "gratitude",
    "text": "I am always in the right place at the right time."
  },
  {
    "id": "public:p-b494efa8d34c3ce5e1b6",
    "category": "gratitude",
    "text": "I expect the best and I get it NOW!"
  },
  {
    "id": "public:p-fa3d9a2e6ee74d5d1d3e",
    "category": "gratitude",
    "text": "I always get everything that is for my highest good."
  },
  {
    "id": "public:p-92af5f56f6356f8fe661",
    "category": "gratitude",
    "text": "Everything good is coming to me easily and effortlessly."
  },
  {
    "id": "public:p-3f4cb3da47f574fa442b",
    "category": "gratitude",
    "text": "I am divinely guided in all I do."
  },
  {
    "id": "public:p-bd27ae2fe5584b592c9e",
    "category": "gratitude",
    "text": "I expect life to give me what is best for me."
  },
  {
    "id": "public:p-f6e295da7d24e9bf5ddc",
    "category": "gratitude",
    "text": "I deserve the best and it comes to me NOW!"
  },
  {
    "id": "public:p-9085de464e4beffaef0e",
    "category": "gratitude",
    "text": "This is a rich universe and there is plenty for all of us."
  },
  {
    "id": "public:p-6ebb56241e10e95fc370",
    "category": "gratitude",
    "text": "I now eagerly await my greatest good."
  },
  {
    "id": "public:p-fb13369f64f5f023c802",
    "category": "gratitude",
    "text": "I expect good fortune every moment of my life."
  },
  {
    "id": "public:p-e03324533e62664edbbf",
    "category": "gratitude",
    "text": "I am open to receive the abundant good that God has for me."
  },
  {
    "id": "public:p-ae832d75252aaef9423c",
    "category": "gratitude",
    "text": "God is the source of all my good; I look only to Him for my supply."
  },
  {
    "id": "public:p-d4594591209205ec0ad9",
    "category": "gratitude",
    "text": "I envision only that which is for my highest good."
  },
  {
    "id": "public:p-8a6f4a3cd5756089ab31",
    "category": "gratitude",
    "text": "My highest good is manifesting in my life right now."
  },
  {
    "id": "public:p-85246cb0d0aaeb5b6f5e",
    "category": "gratitude",
    "text": "God's wealth is circulating in my life. His wealth flows to me in avalanches of abundance. All my needs, desires and goals are met instantaneously because I am one with God, and God is everything."
  },
  {
    "id": "public:p-8785cb90932776c1aaf4",
    "category": "gratitude",
    "text": "I, ________, am now open to receive."
  },
  {
    "id": "public:p-8cf055a45ee2d63b12ad",
    "category": "gratitude",
    "text": "Life is easy; I have an abundance of whatever I need."
  },
  {
    "id": "public:p-5ba3ba3fd8489c071d3c",
    "category": "gratitude",
    "text": "I now have surplus, all my needs are being met."
  },
  {
    "id": "public:p-cbae7c8133f7bfe18a77",
    "category": "gratitude",
    "text": "I have unlimited abundance."
  },
  {
    "id": "public:p-cf7f5530ea3d8846adf8",
    "category": "gratitude",
    "text": "I, _______, now give and receive freely."
  },
  {
    "id": "public:p-76ce9f902de3f608ddc7",
    "category": "gratitude",
    "text": "I now live in a rich and loving universe."
  },
  {
    "id": "public:p-a9ac1f946bc423612a1b",
    "category": "gratitude",
    "text": "Money comes to me easily and effortlessly."
  },
  {
    "id": "public:p-79c8d9a7432a1f08ffc4",
    "category": "gratitude",
    "text": "I am always supplied with whatever I need."
  },
  {
    "id": "public:p-94d910fabf11e44d15b5",
    "category": "gratitude",
    "text": "I move forward with an expectancy of my greatest good."
  },
  {
    "id": "public:p-cd6c1c84e78c23249b93",
    "category": "gratitude",
    "text": "I look for and receive a bountiful supply."
  },
  {
    "id": "public:p-1c2ed79cd4a395ad1bd3",
    "category": "gratitude",
    "text": "My greatest good is coming to me NOW."
  },
  {
    "id": "public:p-62c21e279f8a30cbb3f0",
    "category": "calm",
    "text": "I am one with all things; everything I seek is seeking me."
  },
  {
    "id": "public:p-9f7243c80e2c56bee647",
    "category": "calm",
    "text": "I am relaxed and at peace with myself"
  },
  {
    "id": "public:p-2b87e6260ea955062c1c",
    "category": "calm",
    "text": "I am a peace with myself and my surroundings."
  },
  {
    "id": "public:p-31be0530a4b3b2b65916",
    "category": "calm",
    "text": "I now view life as a wondrous adventure."
  },
  {
    "id": "public:p-dfeed2f100a8abe43807",
    "category": "calm",
    "text": "I now release all negative emotions."
  },
  {
    "id": "public:p-41e579e9faf7bcaf970f",
    "category": "calm",
    "text": "I look only to God as my comforter."
  },
  {
    "id": "public:p-bedaa4af85530473a684",
    "category": "calm",
    "text": "I now let go of all negative emotions."
  },
  {
    "id": "public:p-a9901bc825bbb82bd5bc",
    "category": "calm",
    "text": "I now release my inner Joy which I know myself to be."
  },
  {
    "id": "public:p-bad606a26937cc28c16e",
    "category": "calm",
    "text": "All is good in my world; I give thanks to a wondrous God."
  },
  {
    "id": "public:p-2e2ca4a760cfa739162b",
    "category": "calm",
    "text": "I can relax easily"
  },
  {
    "id": "public:p-0f5318d1e349227e60d9",
    "category": "calm",
    "text": "I find it easy to relax"
  },
  {
    "id": "public:p-a2c976b8ea1a38f74261",
    "category": "calm",
    "text": "I enjoy relaxing"
  },
  {
    "id": "public:p-e80ef2cef0e74d017e5c",
    "category": "calm",
    "text": "I feel calm"
  },
  {
    "id": "public:p-87170b0e69c72cf0797b",
    "category": "calm",
    "text": "Calmness is relaxing"
  },
  {
    "id": "public:p-9f83f187a2e2f8403b91",
    "category": "calm",
    "text": "I enjoy spending time relaxing"
  },
  {
    "id": "public:p-f6513cf7d123f893479b",
    "category": "calm",
    "text": "I am peaceful and relaxed"
  },
  {
    "id": "public:p-3d0122bd0882cff5bb18",
    "category": "calm",
    "text": "My mind is calm"
  },
  {
    "id": "public:p-5625d624dfb5d9fc8884",
    "category": "calm",
    "text": "My body and mind are calm and relaxed"
  },
  {
    "id": "public:p-e98dc13ae61fedb402fb",
    "category": "calm",
    "text": "I am at peace with myself"
  },
  {
    "id": "public:p-1314aaf66a37be83909a",
    "category": "calm",
    "text": "I am a reflection of my divine nature"
  },
  {
    "id": "public:p-aaa3b2fbab6586f15460",
    "category": "calm",
    "text": "I feel safe and loved"
  },
  {
    "id": "public:p-4a53c192e7fef43d21db",
    "category": "calm",
    "text": "I am relaxed and at ease in myself"
  },
  {
    "id": "public:p-631d9ec4eafdf29b40a5",
    "category": "calm",
    "text": "Everything is working in my life"
  },
  {
    "id": "public:p-dd4b0754e4ee033a2314",
    "category": "calm",
    "text": "My mind is calm and relaxed"
  },
  {
    "id": "public:p-b3ca0a2527e5c987e5cc",
    "category": "calm",
    "text": "I am worthy of love and respect"
  },
  {
    "id": "public:p-397fdb04c9bc97b5561e",
    "category": "calm",
    "text": "I am free to choose in each moment"
  },
  {
    "id": "public:p-ef046b301f57b6b79232",
    "category": "calm",
    "text": "I now choose to experience love and joy"
  },
  {
    "id": "public:p-c2e246c29340305b4061",
    "category": "calm",
    "text": "I experience tranquility in this moment."
  },
  {
    "id": "public:p-c2d120312c931e8cd84b",
    "category": "calm",
    "text": "I freely give and receive love"
  },
  {
    "id": "public:p-ee6cd2aba01c9ca5e2a2",
    "category": "learning",
    "text": "My intelligence is increasing daily."
  },
  {
    "id": "public:p-9f288aa259ee869a140b",
    "category": "learning",
    "text": "I now have easy access to my creative potential."
  },
  {
    "id": "public:p-34066473d8c4c0f59b3b",
    "category": "learning",
    "text": "My brain is my best friend."
  },
  {
    "id": "public:p-afee3179b42191661496",
    "category": "learning",
    "text": "My super intelligence is my best ally."
  },
  {
    "id": "public:p-b938d2ff5d8e499b2804",
    "category": "learning",
    "text": "I am a not limits person."
  },
  {
    "id": "public:p-2ce5c004c398a6f4ad8d",
    "category": "learning",
    "text": "I now have easy access to all areas of my brain."
  },
  {
    "id": "public:p-d1f1ae4206358d9f2b73",
    "category": "learning",
    "text": "Through the use of my brain I have access to all intelligence."
  },
  {
    "id": "public:p-764c3ea85330aa1ce29a",
    "category": "perspective",
    "text": "I now feel good about myself."
  },
  {
    "id": "public:p-d848ba0fafb0c3f11227",
    "category": "perspective",
    "text": "I can achieve what ever, I set my mind on."
  },
  {
    "id": "public:p-4cdd07c94aa8ed1de89b",
    "category": "perspective",
    "text": "I am self-reliant and beautiful."
  },
  {
    "id": "public:p-9be8a47258db2c0493dd",
    "category": "perspective",
    "text": "I now feel happy and blissful just being alive."
  },
  {
    "id": "public:p-4bba9047686b102d25ed",
    "category": "perspective",
    "text": "I am improving in all areas of my life."
  },
  {
    "id": "public:p-c37c588f5e02c9a09245",
    "category": "perspective",
    "text": "I now live a life of balance and harmony."
  },
  {
    "id": "public:p-a5c62598e218306d1285",
    "category": "perspective",
    "text": "I now like myself just the way I am."
  },
  {
    "id": "public:p-e2eb4bb0d58dd666e6c6",
    "category": "perspective",
    "text": "I now focus on my needs, knowing they are met in perfect right action."
  },
  {
    "id": "public:p-84aa436316d106707132",
    "category": "perspective",
    "text": "I am being all I can."
  },
  {
    "id": "public:p-a02f14f58e087114e676",
    "category": "perspective",
    "text": "I am better at what I do"
  },
  {
    "id": "public:p-e54981047cb8f0e9af10",
    "category": "perspective",
    "text": "I am achieving what I want to achieve"
  },
  {
    "id": "public:p-b96ec91dfc7f32bd09a8",
    "category": "perspective",
    "text": "I am fulfilling my needs"
  },
  {
    "id": "public:p-8e7e779a1e7a47f81b61",
    "category": "perspective",
    "text": "I am a better person"
  },
  {
    "id": "public:p-383133321ef9cfb5c475",
    "category": "perspective",
    "text": "I am always improving"
  },
  {
    "id": "public:p-523ef3ccbf15e2487b56",
    "category": "perspective",
    "text": "I am a more all-round person"
  },
  {
    "id": "public:p-ed856e49e85fac578480",
    "category": "perspective",
    "text": "My character is improving"
  },
  {
    "id": "public:p-fd2c1069380d4f928999",
    "category": "perspective",
    "text": "I am more mature"
  },
  {
    "id": "public:p-fed524eac2f32588a7e6",
    "category": "perspective",
    "text": "I am aware of my needs"
  },
  {
    "id": "public:p-f685feb1caaac66e615b",
    "category": "perspective",
    "text": "I am happier"
  },
  {
    "id": "public:p-b436f4e28f1e0127a9c0",
    "category": "perspective",
    "text": "I am getting quicker"
  },
  {
    "id": "public:p-aa89895743ddf3c27188",
    "category": "perspective",
    "text": "My thoughts are quick"
  },
  {
    "id": "public:p-2dae18afe782e4a8ee85",
    "category": "perspective",
    "text": "I can think and act quickly"
  },
  {
    "id": "public:p-1570f15311bc025862a7",
    "category": "perspective",
    "text": "My reactions are getting better"
  },
  {
    "id": "public:p-f2373b9e935ddcbedf9b",
    "category": "perspective",
    "text": "I am learning to be quicker"
  },
  {
    "id": "public:p-ae5c32acca2a0cb9bd5f",
    "category": "creativity",
    "text": "I am creative"
  },
  {
    "id": "public:p-795208aa600aabe5867f",
    "category": "creativity",
    "text": "I have creative skills"
  },
  {
    "id": "public:p-12a57837120b81f36c51",
    "category": "creativity",
    "text": "I am able to see the world in different ways"
  },
  {
    "id": "public:p-828358b6493f3b34bf8c",
    "category": "creativity",
    "text": "I lead a creative life"
  },
  {
    "id": "public:p-58241bdf984b03261dbd",
    "category": "creativity",
    "text": "I am open to ambiguity"
  },
  {
    "id": "public:p-d39dd4708d2cad87e5b1",
    "category": "creativity",
    "text": "I consider all possibilities"
  },
  {
    "id": "public:p-0d2d95201dc5ed535328",
    "category": "creativity",
    "text": "I have a constant flow of new ideas"
  },
  {
    "id": "public:p-f54d314af88ef8a5274b",
    "category": "creativity",
    "text": "I am happy to think about various solutions"
  },
  {
    "id": "public:p-f1eb2955f0992fb6ee08",
    "category": "creativity",
    "text": "I use every problem as an opportunity to learn"
  },
  {
    "id": "public:p-55d5afafaca3be1cff24",
    "category": "creativity",
    "text": "I like to be creative"
  },
  {
    "id": "public:p-58d000637846bb2e5a43",
    "category": "creativity",
    "text": "Being creative is rewarding"
  },
  {
    "id": "public:p-3c30c9c83cb4332fc83a",
    "category": "creativity",
    "text": "I enjoy experiencing new things"
  },
  {
    "id": "public:p-cf3bdaf8ce6c77c60726",
    "category": "creativity",
    "text": "I am open to new suggestions"
  },
  {
    "id": "public:p-cf1dbb10a1f04e5fda89",
    "category": "creativity",
    "text": "I am becoming more and more creative every day"
  },
  {
    "id": "public:p-e49ec1c82062984d4923",
    "category": "follow-through",
    "text": "I am motivated"
  },
  {
    "id": "public:p-a1c6d740013cb91b793c",
    "category": "follow-through",
    "text": "I am doing what needs to be done"
  },
  {
    "id": "public:p-8e113e89e41415f81e8b",
    "category": "follow-through",
    "text": "I like achieving my goals"
  },
  {
    "id": "public:p-0d79f8a958e3d665e5a8",
    "category": "follow-through",
    "text": "I am working towards my goals"
  },
  {
    "id": "public:p-bed239339e3db2e3e8bf",
    "category": "follow-through",
    "text": "I feel passionately that I must do my work"
  },
  {
    "id": "public:p-976db31049a20875f44a",
    "category": "follow-through",
    "text": "My goals are very important to me"
  },
  {
    "id": "public:p-8da2b89d523ff0c26cdb",
    "category": "follow-through",
    "text": "I am happy achieving my goals"
  },
  {
    "id": "public:p-90dd8643cad9fb0d7bbf",
    "category": "follow-through",
    "text": "I always succeed"
  },
  {
    "id": "public:p-53ab9fed594160e6a7fd",
    "category": "follow-through",
    "text": "I love to win"
  },
  {
    "id": "public:p-58e0d053076e595b0586",
    "category": "follow-through",
    "text": "I am a successful"
  },
  {
    "id": "public:p-a55e804d5a48acb22562",
    "category": "follow-through",
    "text": "I always get the outcome I desire"
  },
  {
    "id": "public:p-61e71cd34181d3d01618",
    "category": "follow-through",
    "text": "I am now achieving my greatest good"
  },
  {
    "id": "public:p-b3616806d0d66e94e66d",
    "category": "follow-through",
    "text": "My dreams are now being realized"
  },
  {
    "id": "public:p-cefa0956d0c3285452e1",
    "category": "follow-through",
    "text": "I now hold a strong focus on what I want to achieve"
  },
  {
    "id": "public:p-747d104135f72ffe03a1",
    "category": "follow-through",
    "text": "I easily move from one completed task to the next"
  },
  {
    "id": "public:p-018b721c5486a35bc6df",
    "category": "follow-through",
    "text": "I am becoming the best me I can"
  },
  {
    "id": "public:p-4e88960381e9dc51c761",
    "category": "follow-through",
    "text": "I challenge my self and always move forward successfully"
  },
  {
    "id": "public:p-d6396427fa02b5d59fbd",
    "category": "follow-through",
    "text": "I have massive inner drive"
  },
  {
    "id": "public:p-2fd2a2f9fd26007f61f3",
    "category": "follow-through",
    "text": "I am very self motivated"
  },
  {
    "id": "public:p-25108c52788c42183e4a",
    "category": "follow-through",
    "text": "When focus on something I am unstoppable"
  },
  {
    "id": "public:p-0173560b7a0659b997ad",
    "category": "follow-through",
    "text": "I have a clear image of what I want to achieve"
  },
  {
    "id": "public:p-db08971453699fce30e5",
    "category": "follow-through",
    "text": "I am a winner"
  },
  {
    "id": "public:p-82d13b2f59a2c6028b9e",
    "category": "follow-through",
    "text": "I enjoy winning"
  },
  {
    "id": "public:p-7f095987366e805be345",
    "category": "follow-through",
    "text": "Winning makes me feel great"
  },
  {
    "id": "public:p-e251e639f1a6f6a9254d",
    "category": "follow-through",
    "text": "I am successful"
  },
  {
    "id": "public:p-b32d429cc6e81d59ff63",
    "category": "follow-through",
    "text": "I am good at what I do"
  },
  {
    "id": "public:p-9e0761e6d3fb94dff8dd",
    "category": "follow-through",
    "text": "I am increasingly successful"
  },
  {
    "id": "public:p-29b9fd509c209da535d0",
    "category": "follow-through",
    "text": "I am happy being successful"
  },
  {
    "id": "public:p-c1f139bcd2d81b6c2dd4",
    "category": "follow-through",
    "text": "I am a success"
  },
  {
    "id": "public:p-e804660559c42b927a60",
    "category": "follow-through",
    "text": "I am completing my tasks well"
  },
  {
    "id": "public:p-010306c44577090e739a",
    "category": "follow-through",
    "text": "I compete successfully"
  },
  {
    "id": "public:p-e0fbbd8dd3e5a8676fac",
    "category": "follow-through",
    "text": "I am a high achiever"
  },
  {
    "id": "public:p-a462c0889c700cfa0f79",
    "category": "follow-through",
    "text": "I get the results I want"
  },
  {
    "id": "public:p-2ebd8e2376fa9ab361a6",
    "category": "follow-through",
    "text": "I win against the odds"
  },
  {
    "id": "public:p-a9ce2d1e42f00128c0cd",
    "category": "follow-through",
    "text": "Victory is mine"
  },
  {
    "id": "public:p-67ec2fa48950b6c704e5",
    "category": "connection",
    "text": "I love and accept myself exactly as I am."
  },
  {
    "id": "public:p-632ca3d19d928ab7379d",
    "category": "connection",
    "text": "I now express love to all those I meet."
  },
  {
    "id": "public:p-0d3feffb84220d77a57a",
    "category": "connection",
    "text": "I am a radiating center of divine love."
  },
  {
    "id": "public:p-3e0e52031b6fe24d9166",
    "category": "connection",
    "text": "Divine love is working through me now."
  },
  {
    "id": "public:p-500f0aa55ec244394b9b",
    "category": "connection",
    "text": "I bathe in the unconditional love of my Creator, and it radiates from me at all times."
  },
  {
    "id": "public:p-203d29c6b4bc6b18a357",
    "category": "connection",
    "text": "I love myself completely."
  },
  {
    "id": "public:p-5660bc39ea02eac0aab3",
    "category": "connection",
    "text": "Love comes to me easily and effortlessly."
  },
  {
    "id": "public:p-dd16236628033f8a747e",
    "category": "connection",
    "text": "I give and receive love easily and joyfully."
  },
  {
    "id": "public:p-c48c50ca3e7c7baf2dfb",
    "category": "connection",
    "text": "Others love me easily and joyfully."
  },
  {
    "id": "public:p-183a6cb2145f471188be",
    "category": "connection",
    "text": "I now feel loved and appreciated by my parents, my friends."
  },
  {
    "id": "public:p-f14d7f707abc65b1f6eb",
    "category": "connection",
    "text": "I express my love freely, knowing that as I give love, I am instantly supplied with more."
  },
  {
    "id": "public:p-5b4733ce98c484c3776a",
    "category": "connection",
    "text": "I radiate love to all persons and places and things."
  },
  {
    "id": "public:p-00c00e9868a67c61cac1",
    "category": "connection",
    "text": "People are just waiting to love me, and I allow them."
  },
  {
    "id": "public:p-82c26ff93dff3883daf8",
    "category": "connection",
    "text": "I breathe in universal love, and it radiates through every cell in my body."
  },
  {
    "id": "public:p-222ba776eff0d32c49ef",
    "category": "connection",
    "text": "I attract loving, beautiful people into my life."
  },
  {
    "id": "public:p-fa7353d6c7e4e30dd547",
    "category": "connection",
    "text": "I always deserve love."
  },
  {
    "id": "public:p-db02ed523cf1329baa75",
    "category": "connection",
    "text": "I am attracting loving relationships into my life."
  },
  {
    "id": "public:p-31110ccd87d417cc58c8",
    "category": "connection",
    "text": "I project love to everyone I meet."
  },
  {
    "id": "public:p-2d92f0dbd710006acfde",
    "category": "connection",
    "text": "I love and approve of myself."
  },
  {
    "id": "public:p-fa242a159e10f19d401c",
    "category": "connection",
    "text": "I am attractive"
  },
  {
    "id": "public:p-be7b05e2a7dba1713de4",
    "category": "connection",
    "text": "I am a loveable human being"
  },
  {
    "id": "public:p-4ebb391e9aa2a3482c9f",
    "category": "connection",
    "text": "People see the light within me"
  },
  {
    "id": "public:p-fcad7207574d5b8e232b",
    "category": "connection",
    "text": "I see the light within other people"
  },
  {
    "id": "public:p-eb7dfd586da8160ef718",
    "category": "connection",
    "text": "People are drawn to me"
  },
  {
    "id": "public:p-4b8ec791b4d3cf01bb2a",
    "category": "connection",
    "text": "I am warm and caring towards others"
  },
  {
    "id": "public:p-4f6a3369c7022c72fc49",
    "category": "connection",
    "text": "I make friends easily"
  },
  {
    "id": "public:p-1eb978c14a6827f06856",
    "category": "connection",
    "text": "I am attracted to caring people"
  },
  {
    "id": "public:p-ce304d37d41f79d6c9b6",
    "category": "connection",
    "text": "I am confident when approaching potential lovers"
  },
  {
    "id": "public:p-8f5c606f1b2defffa399",
    "category": "connection",
    "text": "People see me as a lover"
  },
  {
    "id": "public:p-867cdbf7daa35ab00ed9",
    "category": "connection",
    "text": "I give out unconditional love"
  },
  {
    "id": "public:p-5a906b6f7d03c4054cde",
    "category": "connection",
    "text": "I love myself as well as others."
  },
  {
    "id": "public:p-35d7e4968738d240e833",
    "category": "connection",
    "text": "What I put out comes back."
  },
  {
    "id": "public:p-42472f6dcf43a77f22c9",
    "category": "connection",
    "text": "Love is coming to me easily and effortlessly."
  },
  {
    "id": "public:p-4829ca82126dcf643b11",
    "category": "connection",
    "text": "I have a clear image of what I want in a relationship."
  },
  {
    "id": "public:p-133f266e54304c36a4c9",
    "category": "connection",
    "text": "I am now ready for a relationship"
  },
  {
    "id": "public:p-2d175b0100b8f6b8270a",
    "category": "connection",
    "text": "I give and receive love."
  },
  {
    "id": "public:p-b778d25729364c93044b",
    "category": "connection",
    "text": "I deserve love."
  },
  {
    "id": "public:p-ffa955253b8d00b71099",
    "category": "connection",
    "text": "I now believe that relationships can be joyful and fun."
  },
  {
    "id": "public:p-29ccc5f022c02b280de9",
    "category": "connection",
    "text": "I am open to receive loving relationships."
  },
  {
    "id": "public:p-9d3131e3c2123cddae44",
    "category": "connection",
    "text": "I open up to others. I give and receive love."
  },
  {
    "id": "public:p-21fec451fc437357cc34",
    "category": "connection",
    "text": "I risk myself in love. I allow myself to be vulnerable."
  },
  {
    "id": "public:p-2ba9de14d30c33abcc8c",
    "category": "connection",
    "text": "The more I give to others, the more capacity I have to receive."
  },
  {
    "id": "public:p-cac5e2b26f188624b46b",
    "category": "connection",
    "text": "I am ready to receive sexual fulfillment."
  },
  {
    "id": "public:p-75c25bd5833983357860",
    "category": "connection",
    "text": "As my self-love increases so does my love for (________)"
  },
  {
    "id": "public:p-58dc2926a79f5610060b",
    "category": "connection",
    "text": "I project love."
  },
  {
    "id": "public:p-48aa2df6f657c4c55e25",
    "category": "connection",
    "text": "My relationship with (_______) is blossoming."
  },
  {
    "id": "public:p-6034b3f5034efc147d24",
    "category": "connection",
    "text": "I transmit sexual and loving energy."
  },
  {
    "id": "public:p-34edf933715188a39281",
    "category": "connection",
    "text": "I trust my partner"
  },
  {
    "id": "public:p-bdca3c3789f4b70c008f",
    "category": "connection",
    "text": "My partner trusts me"
  },
  {
    "id": "public:p-5cea18095770bdd344fd",
    "category": "connection",
    "text": "I love my partner"
  },
  {
    "id": "public:p-dccffc60b7922dd0303b",
    "category": "connection",
    "text": "My partner loves me"
  },
  {
    "id": "public:p-f85abf113d1910fcf58e",
    "category": "connection",
    "text": "I respect my partner"
  },
  {
    "id": "public:p-8ac9c165e988c94eb5f5",
    "category": "connection",
    "text": "I can discuss anything with my partner"
  },
  {
    "id": "public:p-df880ff6ba493affbc95",
    "category": "connection",
    "text": "I have a good relationship"
  },
  {
    "id": "public:p-02d37edbd61f40069f5e",
    "category": "connection",
    "text": "I am in love"
  },
  {
    "id": "public:p-54b4937ff9896b1bf649",
    "category": "connection",
    "text": "I forgive my partner for mistakes"
  },
  {
    "id": "public:p-666aa4aaa92b1811a470",
    "category": "connection",
    "text": "My partner forgives me for my mistakes"
  },
  {
    "id": "public:p-92e174a79c0f37841478",
    "category": "connection",
    "text": "I am honest with my partner"
  },
  {
    "id": "public:p-853231e78260e114c7ec",
    "category": "connection",
    "text": "My partner is honest with me"
  },
  {
    "id": "public:p-33c519c327c166f9ff59",
    "category": "connection",
    "text": "I like to talk with my partner"
  },
  {
    "id": "public:p-bbbcd0e5cded440a0fd4",
    "category": "connection",
    "text": "I am interested in meeting others"
  },
  {
    "id": "public:p-fcb7f70fdf90c331ce79",
    "category": "connection",
    "text": "I am a good friend"
  },
  {
    "id": "public:p-ac0d2c2159a44bfde36c",
    "category": "connection",
    "text": "I enjoy the company of others"
  },
  {
    "id": "public:p-70d0d675b1ddb13a3a91",
    "category": "connection",
    "text": "Others find me interesting"
  },
  {
    "id": "public:p-1729d028724412d91c35",
    "category": "connection",
    "text": "I enjoy listening to others"
  },
  {
    "id": "public:p-44c9f9b920205844f1ce",
    "category": "connection",
    "text": "I am a fun person to be around"
  },
  {
    "id": "public:p-451baf8bffcb1df6f189",
    "category": "connection",
    "text": "I enjoy sharing with others"
  },
  {
    "id": "public:p-f2a4143ebce2adc26709",
    "category": "connection",
    "text": "People want to hear what I have to say"
  },
  {
    "id": "public:p-3709895ec2e8cebef2be",
    "category": "connection",
    "text": "I am relaxed when around others"
  },
  {
    "id": "public:p-93aef23ce0bbda1198b6",
    "category": "connection",
    "text": "I am a good conversationalist"
  },
  {
    "id": "public:p-1959dfd487da25eeebc2",
    "category": "connection",
    "text": "I like my friends just the way they are"
  },
  {
    "id": "public:p-6314978ac6600ceac958",
    "category": "connection",
    "text": "I am confident around others"
  },
  {
    "id": "public:p-2d6e1c42ac7ff34cf729",
    "category": "connection",
    "text": "I like meeting new people"
  },
  {
    "id": "public:p-31477660a9e4c20d9edb",
    "category": "connection",
    "text": "I enjoy sharing my thoughts with others"
  },
  {
    "id": "public:p-225c84fc7aa04f469f77",
    "category": "connection",
    "text": "People make me happy"
  },
  {
    "id": "public:p-671bcf004307bdeff0d7",
    "category": "confidence",
    "text": "I make my opinions known"
  },
  {
    "id": "public:p-5cdc971ae9b5a19a6494",
    "category": "confidence",
    "text": "My opinions are worthwhile"
  },
  {
    "id": "public:p-8df9693fb45d36cc11d7",
    "category": "confidence",
    "text": "I make a valuable contribution"
  },
  {
    "id": "public:p-6d66ce277491f3011980",
    "category": "confidence",
    "text": "I am important"
  },
  {
    "id": "public:p-f14ce7d575cd1006ed71",
    "category": "confidence",
    "text": "My views are important"
  },
  {
    "id": "public:p-b0eff6a57aaf699dee9e",
    "category": "confidence",
    "text": "People listen to me"
  },
  {
    "id": "public:p-7bfdd06b0f4441fb8343",
    "category": "confidence",
    "text": "People want to hear me"
  },
  {
    "id": "public:p-7a27a04f60e378fa1bff",
    "category": "confidence",
    "text": "I am changing my life"
  },
  {
    "id": "public:p-219f13cbbb7bcf770bf4",
    "category": "confidence",
    "text": "I am taking charge of my life"
  },
  {
    "id": "public:p-a58f39099fe8475b876a",
    "category": "confidence",
    "text": "I react well with bullies"
  },
  {
    "id": "public:p-38ab54855dd8221899b4",
    "category": "confidence",
    "text": "I expect people to be kind to me"
  },
  {
    "id": "public:p-a49be2c45fef02c75c92",
    "category": "confidence",
    "text": "I deserve to be treated well"
  },
  {
    "id": "public:p-2e1f6b1dd3785e622708",
    "category": "confidence",
    "text": "I demand to be treated well"
  },
  {
    "id": "public:p-a450ddfeef1839b6971d",
    "category": "confidence",
    "text": "I demand respect"
  },
  {
    "id": "public:p-491eb40d353e2fad87f8",
    "category": "confidence",
    "text": "I do what I want to do"
  },
  {
    "id": "public:p-be0baebd39d95b501b8e",
    "category": "confidence",
    "text": "I let do only those things I like"
  },
  {
    "id": "public:p-1f24601fb7d6d62a4852",
    "category": "confidence",
    "text": "I ask for what I want"
  },
  {
    "id": "public:p-e05a4febc1ecebcb0f08",
    "category": "confidence",
    "text": "I tell people what I want"
  },
  {
    "id": "public:p-903ed427366f6569df9c",
    "category": "confidence",
    "text": "I can say NO"
  },
  {
    "id": "public:p-4219cfdcce9e539fdefb",
    "category": "confidence",
    "text": "I can refuse things I do not want"
  },
  {
    "id": "public:p-1846488aa552840f0198",
    "category": "confidence",
    "text": "I cope well when others are unhappy"
  },
  {
    "id": "public:p-6afd86a6ee55f9c3835a",
    "category": "confidence",
    "text": "I do things which please me"
  },
  {
    "id": "public:p-1a8a01f064bb665a044f",
    "category": "self-kindness",
    "text": "I am perfectly healthy in body, mind and spirit."
  },
  {
    "id": "public:p-a6a3fa35d0fb5081eda1",
    "category": "self-kindness",
    "text": "I am well, I am whole, and I am strong and healthy."
  },
  {
    "id": "public:p-066b5ef6d3da73079084",
    "category": "self-kindness",
    "text": "I am healthy, and full of energy and vitality."
  },
  {
    "id": "public:p-472b475964ba971f087d",
    "category": "self-kindness",
    "text": "All the cells of my body are daily bathed in the perfection of my divine being."
  },
  {
    "id": "public:p-c3348a1e3440f820f74f",
    "category": "self-kindness",
    "text": "I am healthy, happy and radiant."
  },
  {
    "id": "public:p-d3a8ebe2b84eb4a237be",
    "category": "self-kindness",
    "text": "I radiate good health."
  },
  {
    "id": "public:p-f52563ed5c577ca76afc",
    "category": "self-kindness",
    "text": "My body is a safe and pleasurable place for me to be."
  },
  {
    "id": "public:p-c8408766fd681a985875",
    "category": "self-kindness",
    "text": "My sleep is relaxed and refreshing."
  },
  {
    "id": "public:p-929a674a05a4104a0c6f",
    "category": "self-kindness",
    "text": "I have all the energy I need to accomplish my goals and to fulfill my desires."
  },
  {
    "id": "public:p-8b33c3a986ad94b4a62a",
    "category": "self-kindness",
    "text": "God's love heals me and makes me whole."
  },
  {
    "id": "public:p-db147b086336fa83340c",
    "category": "self-kindness",
    "text": "My body is healed, restored and filled with energy."
  },
  {
    "id": "public:p-6e7a1e41ae7f49a25924",
    "category": "self-kindness",
    "text": "My connection to the universe is pure love."
  },
  {
    "id": "public:p-9ffa4f8f7d6e61e18fdc",
    "category": "self-kindness",
    "text": "Every day, in every way, I am getting better and better."
  },
  {
    "id": "public:p-8410c8b7b447d052b329",
    "category": "self-kindness",
    "text": "I have all the energy required for my needs."
  },
  {
    "id": "public:p-e39cb61f04389eb846d5",
    "category": "self-kindness",
    "text": "The light within me is healing my entire body."
  },
  {
    "id": "public:p-8b68e7476b1f58270078",
    "category": "self-kindness",
    "text": "I am one with the universe. I am healing now."
  },
  {
    "id": "public:p-21f28b640401932dfbc0",
    "category": "self-kindness",
    "text": "Divine light flows through every cell of my body."
  },
  {
    "id": "public:p-016dad5cee0bc3c436bf",
    "category": "self-kindness",
    "text": "I radiate love to everyone I meet."
  },
  {
    "id": "public:p-af2466b088def83af92b",
    "category": "self-kindness",
    "text": "I sleep relaxed and awake refreshed."
  },
  {
    "id": "public:p-df1b497d7a3bee2d1da8",
    "category": "self-kindness",
    "text": "My connection to the universe is my energy source."
  },
  {
    "id": "public:p-16870e88d0803905bf7b",
    "category": "self-kindness",
    "text": "I give and receive love easily and effortlessly."
  },
  {
    "id": "public:p-ece2d0873b29291529d5",
    "category": "self-kindness",
    "text": "I am bathed in radiant light."
  },
  {
    "id": "public:p-c3c62c1a28ad069e4087",
    "category": "self-kindness",
    "text": "I have the power to control my health."
  },
  {
    "id": "public:p-c36a0cea6cbc9d3e3110",
    "category": "self-kindness",
    "text": "I am in control of my health and well being."
  },
  {
    "id": "public:p-035d2e5ce19ba98e7caa",
    "category": "self-kindness",
    "text": "I have abundant energy, vitality and well being."
  },
  {
    "id": "public:p-4d35b458f2a528b7fbce",
    "category": "self-kindness",
    "text": "I am healthy in all areas of my life."
  },
  {
    "id": "public:p-7e860db973cb4affcb0c",
    "category": "self-kindness",
    "text": "I am always able to maintain my ideal weight."
  },
  {
    "id": "public:p-6b95b2d31041d228e41a",
    "category": "self-kindness",
    "text": "I am calm, my mind is at peace."
  },
  {
    "id": "public:p-8d8b209023a882c5680f",
    "category": "self-kindness",
    "text": "I love and care for my body."
  },
  {
    "id": "public:p-7bb0b155bac65bb813f7",
    "category": "self-kindness",
    "text": "I am perfect just the way I am."
  },
  {
    "id": "public:p-19b29838bcda1361435e",
    "category": "self-kindness",
    "text": "I am young"
  },
  {
    "id": "public:p-65dad3a36ab3ba9023f8",
    "category": "self-kindness",
    "text": "I look young"
  },
  {
    "id": "public:p-961cd69f23e128892eb1",
    "category": "self-kindness",
    "text": "I feel young"
  },
  {
    "id": "public:p-55adee5b94806e290568",
    "category": "self-kindness",
    "text": "I feel great"
  },
  {
    "id": "public:p-dd5c58cc14cf877e03ae",
    "category": "self-kindness",
    "text": "I am full of energy"
  },
  {
    "id": "public:p-717b5f30bd8d41d78d15",
    "category": "self-kindness",
    "text": "I love the way I look"
  },
  {
    "id": "public:p-2b96e9da31959d7d9fe9",
    "category": "self-kindness",
    "text": "I sparkle with vitality"
  },
  {
    "id": "public:p-5695d5092afc45f7ea79",
    "category": "self-kindness",
    "text": "I am a dynamic person"
  },
  {
    "id": "public:p-0a0b19fd14d8ce96d5d1",
    "category": "self-kindness",
    "text": "I feel young and powerful"
  },
  {
    "id": "public:p-3951f02f8971911be0f4",
    "category": "self-kindness",
    "text": "I am living to the full"
  },
  {
    "id": "public:p-6e373ce98d3ebee72483",
    "category": "self-kindness",
    "text": "My body functions like a 20 year old"
  },
  {
    "id": "public:p-166856c37ca044437544",
    "category": "self-kindness",
    "text": "I am healed"
  },
  {
    "id": "public:p-e39b5bf5799fc24fbe6b",
    "category": "self-kindness",
    "text": "My skin is improving"
  },
  {
    "id": "public:p-467a1176f6aaee53b000",
    "category": "self-kindness",
    "text": "My spots are disappearing"
  },
  {
    "id": "public:p-8ab59d8bcff803dd5562",
    "category": "self-kindness",
    "text": "My skin is healthy"
  },
  {
    "id": "public:p-94b21b860ed4e6559200",
    "category": "self-kindness",
    "text": "My skin is clean and smooth"
  },
  {
    "id": "public:p-a80a4c9dba4b65b7acc6",
    "category": "self-kindness",
    "text": "All my wrinkles are disappearing"
  },
  {
    "id": "public:p-28b45e28bfd699d16c83",
    "category": "self-kindness",
    "text": "My skin looks good"
  },
  {
    "id": "public:p-1ef6da25d08e90fef333",
    "category": "self-kindness",
    "text": "My skin is supple"
  },
  {
    "id": "public:p-d05d7dbb7eafc6be652a",
    "category": "self-kindness",
    "text": "I like my skin and the way I look"
  },
  {
    "id": "public:p-cf0d54df6ca3935f0f7f",
    "category": "self-kindness",
    "text": "I look good"
  },
  {
    "id": "public:p-4f08c52edce00a3848bb",
    "category": "self-kindness",
    "text": "My eye sight is getting better"
  },
  {
    "id": "public:p-cc1e246da61e0edea016",
    "category": "self-kindness",
    "text": "I can see better"
  },
  {
    "id": "public:p-42b9895d71ab28de7b46",
    "category": "self-kindness",
    "text": "I can focus at all distances"
  },
  {
    "id": "public:p-008aaadc1e533e982575",
    "category": "self-kindness",
    "text": "My vision is better than it was"
  },
  {
    "id": "public:p-912c1814d7863331bf07",
    "category": "self-kindness",
    "text": "My peripheral vision is getting better"
  },
  {
    "id": "public:p-0b1a8dcef9e17d663482",
    "category": "self-kindness",
    "text": "I am less dependent on my glasses"
  },
  {
    "id": "public:p-980a9b409d4127c6114a",
    "category": "self-kindness",
    "text": "I can see better when I relax"
  },
  {
    "id": "public:p-6e909bd79a2f2381c4dd",
    "category": "self-kindness",
    "text": "I can see better in the dark"
  },
  {
    "id": "public:p-2ce3fd8aeac2cd09bd90",
    "category": "self-kindness",
    "text": "My eyes are improving"
  },
  {
    "id": "public:p-3b6ece419b78231338d7",
    "category": "self-kindness",
    "text": "I am happy"
  },
  {
    "id": "public:p-be89155f63dd01c10e89",
    "category": "self-kindness",
    "text": "People like me"
  },
  {
    "id": "public:p-3badf3e9412081d2f3ad",
    "category": "self-kindness",
    "text": "I am a nice person"
  },
  {
    "id": "public:p-b7bd07d7785ee53239bf",
    "category": "self-kindness",
    "text": "I make a difference to the world"
  },
  {
    "id": "public:p-c1162baa09973a18282c",
    "category": "self-kindness",
    "text": "I like my work"
  },
  {
    "id": "public:p-c93e86dc08bb8fe27dff",
    "category": "self-kindness",
    "text": "I am succeeding"
  },
  {
    "id": "public:p-7a0f9852e881e3c32364",
    "category": "self-kindness",
    "text": "I am positive"
  },
  {
    "id": "public:p-63b53c2e2e22c1591f9d",
    "category": "self-kindness",
    "text": "I am confident"
  },
  {
    "id": "public:p-60de7f7e0d1706e30808",
    "category": "self-kindness",
    "text": "I manage my money well"
  },
  {
    "id": "public:p-06fb636066d10dc7eac7",
    "category": "self-kindness",
    "text": "I am a responsible person"
  },
  {
    "id": "public:p-3a6bb798982026840820",
    "category": "self-kindness",
    "text": "I am in control of my life"
  },
  {
    "id": "public:p-a1255c774b51c16c0b03",
    "category": "self-kindness",
    "text": "I am doing more of the things I enjoy"
  },
  {
    "id": "public:p-ba992c3d163bc805a455",
    "category": "self-kindness",
    "text": "I am achieving my goals"
  },
  {
    "id": "public:p-92ba3c9e933970f0663b",
    "category": "self-kindness",
    "text": "I am loveable"
  },
  {
    "id": "public:p-5a0dd1543669e0100b35",
    "category": "self-kindness",
    "text": "I am worthy of love and friendship"
  },
  {
    "id": "public:p-840bd57984617a741571",
    "category": "self-kindness",
    "text": "I accept myself completely"
  },
  {
    "id": "public:p-5371c8e748705d2b27ba",
    "category": "self-kindness",
    "text": "I have a solid sense of self-identity"
  },
  {
    "id": "public:p-236fcca7520483373441",
    "category": "self-kindness",
    "text": "I see myself realistically and objectively"
  },
  {
    "id": "public:p-e4ca13cf459c8a778f65",
    "category": "self-kindness",
    "text": "I find deep inner peace within myself as I am"
  },
  {
    "id": "public:p-28e1012999bb8d5983c0",
    "category": "self-kindness",
    "text": "I say positive things about myself to myself"
  },
  {
    "id": "public:p-0d6eb4958567ec3edbd2",
    "category": "self-kindness",
    "text": "I am a kind, caring and decent person"
  },
  {
    "id": "public:p-acf6cd12a967231c2244",
    "category": "self-kindness",
    "text": "I forgive myself for all I have done"
  },
  {
    "id": "public:p-8a8cecdedb7f772e0651",
    "category": "self-kindness",
    "text": "I forgive every person who has undermined my self-esteem"
  },
  {
    "id": "public:p-c2b78eaf7b3f05220dd1",
    "category": "self-kindness",
    "text": "All false images of myself from the past are now dissolved"
  },
  {
    "id": "public:p-7fb9a0a1b093f91b667a",
    "category": "self-kindness",
    "text": "I love and accept all parts of myself"
  },
  {
    "id": "public:p-09ac3f349856f98de047",
    "category": "self-kindness",
    "text": "I am an interesting person"
  },
  {
    "id": "public:p-bd05382309daa4d1ecaf",
    "category": "self-kindness",
    "text": "I love and accept all of my thoughts and feelings"
  },
  {
    "id": "public:p-1d55ec075d9e90fbb4bd",
    "category": "self-kindness",
    "text": "I am interested in other people"
  },
  {
    "id": "public:p-9a416062cd52a0b532e0",
    "category": "self-kindness",
    "text": "All false messages about me are now dissolved in total grace"
  },
  {
    "id": "public:p-471ccc2cd3d571552c2c",
    "category": "self-kindness",
    "text": "Every day I am getting better and better"
  },
  {
    "id": "public:p-c3fc3fd956e8e4678ec7",
    "category": "self-kindness",
    "text": "I love and approve of myself aside from my accomplishments"
  },
  {
    "id": "public:p-1692cfa5355621332204",
    "category": "self-kindness",
    "text": "I share my feelings with others and they accept me"
  },
  {
    "id": "public:p-3b2773d01acc707a1683",
    "category": "self-kindness",
    "text": "I have positive self esteem"
  },
  {
    "id": "public:p-e797fa60bc3c534898ce",
    "category": "self-kindness",
    "text": "My self esteem comes from inside me"
  },
  {
    "id": "public:p-eeaca5b4bbb975efb405",
    "category": "self-kindness",
    "text": "I accept myself completely as I am"
  },
  {
    "id": "public:p-71464600e5ca5daa7bba",
    "category": "self-kindness",
    "text": "I value and honor myself as I am"
  },
  {
    "id": "public:p-3367dcd33f9a96bb04eb",
    "category": "self-kindness",
    "text": "I strive to improve myself"
  },
  {
    "id": "public:p-f140e7cab6f5aacb8487",
    "category": "self-kindness",
    "text": "I am loving and accepting of myself just as I am"
  },
  {
    "id": "public:p-b9aa014ac00184b5e978",
    "category": "self-kindness",
    "text": "I am loving and accepting of myself for who I am becoming"
  },
  {
    "id": "public:p-8c3ca275a53800e0f362",
    "category": "self-kindness",
    "text": "I stand firmly in my powerful positive self-esteem"
  },
  {
    "id": "public:p-521907f955ea67c0cd2f",
    "category": "self-kindness",
    "text": "I believe strongly in my powerful positive self-esteem"
  },
  {
    "id": "public:p-cdf8bf2a9cc8fae874b0",
    "category": "self-kindness",
    "text": "I feel total peace with my powerful positive self-esteem"
  },
  {
    "id": "public:p-64fa955df93c6292bd82",
    "category": "perspective",
    "text": "I now see opportunities in all situations"
  },
  {
    "id": "public:p-949ab02f72b25433b625",
    "category": "perspective",
    "text": "I feel better about myself everyday"
  },
  {
    "id": "public:p-5e1bbdfd061fe69a239d",
    "category": "perspective",
    "text": "I embrace the new"
  },
  {
    "id": "public:p-682d63e119885420d900",
    "category": "perspective",
    "text": "I welcome challenges with confidence"
  },
  {
    "id": "public:p-4b275db0b11ec1b467ed",
    "category": "perspective",
    "text": "I now let go of all negativity"
  },
  {
    "id": "public:p-40fef35ab9d9a49d56a3",
    "category": "perspective",
    "text": "I let go of all negative thinking"
  },
  {
    "id": "public:p-e35f521b7ff1a697f775",
    "category": "perspective",
    "text": "I look forward to this day with a positive expectancy"
  },
  {
    "id": "public:p-298ea57ded17ffb90d23",
    "category": "perspective",
    "text": "I think only those thoughts that will enhance my life"
  },
  {
    "id": "public:p-dfb913325447794863d5",
    "category": "perspective",
    "text": "I now detach from negative and unproductive thinking"
  },
  {
    "id": "public:p-11ef19df634953ccd122",
    "category": "confidence",
    "text": "I am strong and secure"
  },
  {
    "id": "public:p-a569e5906681f19da26f",
    "category": "confidence",
    "text": "I have inner resources"
  },
  {
    "id": "public:p-be3ada95b76c38ac6b74",
    "category": "confidence",
    "text": "I have the power to realize my goals"
  },
  {
    "id": "public:p-e59811de11297551730f",
    "category": "confidence",
    "text": "I take charge of my life"
  },
  {
    "id": "public:p-31deb01b108e467e404d",
    "category": "confidence",
    "text": "I am valuable"
  },
  {
    "id": "public:p-7d17dada4fba4d9caf73",
    "category": "confidence",
    "text": "I stand firmly in my belief in myself"
  },
  {
    "id": "public:p-10c7125d366e2490c65c",
    "category": "confidence",
    "text": "People respect me"
  },
  {
    "id": "public:p-42114ba99c4574bdcd90",
    "category": "confidence",
    "text": "I am a true friend"
  },
  {
    "id": "public:p-4ced75165da9332937d4",
    "category": "confidence",
    "text": "I care for people"
  },
  {
    "id": "public:p-a97627484746148604bb",
    "category": "confidence",
    "text": "I am confident of my capabilities, expertise, and know-how"
  },
  {
    "id": "public:p-1d2fa10f4090c5799eb9",
    "category": "confidence",
    "text": "I am interested in others"
  },
  {
    "id": "public:p-ef55d7f44d491ef37d4e",
    "category": "confidence",
    "text": "I am a strong person"
  },
  {
    "id": "public:p-fccaebbe6b98e7755736",
    "category": "confidence",
    "text": "I dissolve all obstacles to having complete self-confidence"
  },
  {
    "id": "public:p-54aaa322f04da8f4adbb",
    "category": "confidence",
    "text": "I choose to be happy"
  },
  {
    "id": "public:p-c2007de6b384c7287fc2",
    "category": "confidence",
    "text": "I have faith in myself and my future"
  },
  {
    "id": "public:p-58b1b86ffd11d939ea96",
    "category": "confidence",
    "text": "I am courageous"
  },
  {
    "id": "public:p-0675ef052bf2d6f7817f",
    "category": "confidence",
    "text": "I am a hero"
  },
  {
    "id": "public:p-6349b1793df77e242177",
    "category": "confidence",
    "text": "People admire me"
  },
  {
    "id": "public:p-e8e635f66ec620c81b8e",
    "category": "confidence",
    "text": "My self-confidence is in who I am, not what I do"
  },
  {
    "id": "public:p-11e880e57577799991e1",
    "category": "confidence",
    "text": "I deserve to succeed"
  },
  {
    "id": "public:p-bdb961a5d38cb0821d1c",
    "category": "confidence",
    "text": "I am calm"
  },
  {
    "id": "public:p-9eeef4e75901d4115d3f",
    "category": "confidence",
    "text": "I maintain my self-confidence in all times and places"
  },
  {
    "id": "public:p-511c3b523ab2eb77c981",
    "category": "confidence",
    "text": "I forgive myself"
  },
  {
    "id": "public:p-38e04528af0a41d107aa",
    "category": "confidence",
    "text": "I have an inner peace"
  },
  {
    "id": "public:p-d785bc1ecb465624f2b2",
    "category": "confidence",
    "text": "I heal all issues affecting my self-confidence"
  },
  {
    "id": "public:p-5bb7fdb2f96f5d441ebe",
    "category": "confidence",
    "text": "I am intelligent"
  },
  {
    "id": "public:p-6b0cf3fed3e34e71c297",
    "category": "confidence",
    "text": "I forgive myself for any and all past mistakes"
  },
  {
    "id": "public:p-8937df3aeb39f0d38e72",
    "category": "confidence",
    "text": "I am secure in myself"
  },
  {
    "id": "public:p-4b6d8b5f94af02068f6a",
    "category": "confidence",
    "text": "I am confident in myself"
  },
  {
    "id": "public:p-44274f58919f56715d2d",
    "category": "confidence",
    "text": "I discover new aspects of my self-confidence daily"
  },
  {
    "id": "public:p-3fc231740b63a423803b",
    "category": "confidence",
    "text": "I take action"
  },
  {
    "id": "public:p-e3409d4c9f3028ed04f0",
    "category": "confidence",
    "text": "I balance my self-confidence with modesty perfectly"
  },
  {
    "id": "public:p-05c46003f583eabb09a2",
    "category": "confidence",
    "text": "I recognize and honor my talents, abilities, and skills"
  },
  {
    "id": "public:p-445ea83011264eb6a3f3",
    "category": "confidence",
    "text": "I control my destiny"
  },
  {
    "id": "public:p-9608cf511060333019d5",
    "category": "confidence",
    "text": "I see each part of my life as a lesson"
  },
  {
    "id": "public:p-3dfd89a610dd4d433692",
    "category": "confidence",
    "text": "I believe in myself completely"
  },
  {
    "id": "public:p-ec6b8bca65875148b1f9",
    "category": "confidence",
    "text": "I feel confident from the inside out"
  },
  {
    "id": "public:p-50024ea66f0d0dbcbb4a",
    "category": "confidence",
    "text": "I move forward, feeling self-confident every step of the way"
  },
  {
    "id": "public:p-a5665378dcf96362cf2b",
    "category": "confidence",
    "text": "I am secure and confident in my abilities to accomplish my goals"
  },
  {
    "id": "public:p-686f9350d00a2d74fdd9",
    "category": "confidence",
    "text": "I have great inner resources; I know I can do it"
  },
  {
    "id": "public:p-aa60a8e567ab58d9af93",
    "category": "confidence",
    "text": "I now look to past successes to boost my confidence NOW!"
  },
  {
    "id": "public:p-93ee5f2ba0593dac683c",
    "category": "confidence",
    "text": "Every day in every way I am becoming more & more self-confidant"
  },
  {
    "id": "public:p-0e5c1eaf94373fea5098",
    "category": "confidence",
    "text": "I see myself as self reliant and self-confident"
  },
  {
    "id": "public:p-710a02f192a770481b23",
    "category": "confidence",
    "text": "I am confident in my abilities to succeed at _______"
  },
  {
    "id": "public:p-dc2298241d2cc6d2d042",
    "category": "confidence",
    "text": "I move forward towards my goals with ease and confidence"
  },
  {
    "id": "public:p-da7beb8308f50c48a00f",
    "category": "confidence",
    "text": "I convey a positive and self-confident image of myself"
  },
  {
    "id": "public:p-8f28e10349750f8506c1",
    "category": "confidence",
    "text": "When I image something I am confident it will appear in my life"
  },
  {
    "id": "public:p-a5366acd8e383956ef59",
    "category": "confidence",
    "text": "My inner confidence makes it easy for me to move forward"
  },
  {
    "id": "public:p-2f50159c550c4374ce3b",
    "category": "confidence",
    "text": "I am confident that once I set goals and take action success is assured"
  },
  {
    "id": "public:p-e2d324022f912c12abec",
    "category": "confidence",
    "text": "I move toward my goals with confidence, knowing success is mine"
  },
  {
    "id": "public:p-6d086c1b5cfe0bf9a4da",
    "category": "confidence",
    "text": "I expect the best and It come to me."
  },
  {
    "id": "public:p-fcca876fb38fec29f203",
    "category": "confidence",
    "text": "I am confident that I can communicate my needs."
  },
  {
    "id": "public:p-feed96402f07e2e9435a",
    "category": "confidence",
    "text": "My confidence is growing daily."
  },
  {
    "id": "public:p-9aab22cb1ebe2466aa35",
    "category": "confidence",
    "text": "I am confident because I am divinely guided."
  },
  {
    "id": "public:p-bb02f449e0f47446e029",
    "category": "confidence",
    "text": "I am always in the right place and the right time."
  },
  {
    "id": "public:p-5179ca6fb43f24d2da27",
    "category": "confidence",
    "text": "All my needs are being met, now, in this moment."
  },
  {
    "id": "public:p-bde5b18175335b62528a",
    "category": "confidence",
    "text": "I know! I can achieve my hearts desire."
  },
  {
    "id": "public:p-a33f12e5a1a06f892bc4",
    "category": "confidence",
    "text": "I am confident that I can succeed, I am divinely guided."
  },
  {
    "id": "public:p-7fa1079b0966bcc3bbf3",
    "category": "confidence",
    "text": "Love is good for my love is perfect."
  },
  {
    "id": "public:p-45eed3ccf9c61ec3d495",
    "category": "confidence",
    "text": "Love is what I give and receive."
  },
  {
    "id": "public:p-77d5eb2d4e34f8c7045d",
    "category": "confidence",
    "text": "I! always succeed, I always! succeed, I always succeed!."
  },
  {
    "id": "public:p-f261b0ec7918ec36fce9",
    "category": "letting-go",
    "text": "I now release the need to have others conform to my ideas"
  },
  {
    "id": "public:p-9496f8abd6d8820c5a93",
    "category": "letting-go",
    "text": "I now look for the good in others and myself"
  },
  {
    "id": "public:p-a3c33585bc77a8c1f9c4",
    "category": "letting-go",
    "text": "I, ________, release the need to have other acts in a certain way"
  },
  {
    "id": "public:p-a9d32566269407749638",
    "category": "letting-go",
    "text": "When I see the good in others I feel great about myself"
  },
  {
    "id": "public:p-cd1914993461c804d332",
    "category": "letting-go",
    "text": "I, ________, am learning to be more accepting of others"
  },
  {
    "id": "public:p-62db12806359bc6e8c4e",
    "category": "letting-go",
    "text": "I, _________, release expectation that I might have of others"
  },
  {
    "id": "public:p-38802c60e372b4f2e367",
    "category": "letting-go",
    "text": "I, _________, release the need to judge myself and others"
  },
  {
    "id": "public:p-556edddd1c73614432f2",
    "category": "work",
    "text": "I am now attracting my ideal work."
  },
  {
    "id": "public:p-cb4b75c8d8b5e70e4121",
    "category": "work",
    "text": "I am now open to Gods guidance in attaining great employment."
  },
  {
    "id": "public:p-da4203cc3963c907b426",
    "category": "work",
    "text": "My Perfect career is coming to me now."
  },
  {
    "id": "public:p-83f765e0a82c2078429b",
    "category": "work",
    "text": "I do what I love knowing God will create a job around these skills."
  },
  {
    "id": "public:p-0c9d1d0a8436f87b82b5",
    "category": "work",
    "text": "Gods love is my work in action."
  },
  {
    "id": "public:p-df00c88ba876e2d12856",
    "category": "work",
    "text": "I am divinely guided in attracting to me my ideal job."
  },
  {
    "id": "public:p-6176907f072f73a00db7",
    "category": "work",
    "text": "My perfect career is now supporting me in all my needs."
  },
  {
    "id": "public:p-ad902b3af3be7491ece7",
    "category": "work",
    "text": "I look only to God for my good fortune."
  },
  {
    "id": "public:p-d63ec1c87a0a1894afe8",
    "category": "work",
    "text": "I am now attracting all I need to express my perfect work."
  },
  {
    "id": "public:p-bc594b09ffb418b76ed0",
    "category": "work",
    "text": "My special skills are now being noticed."
  },
  {
    "id": "public:p-f1c276e21bfb31489918",
    "category": "work",
    "text": "I am a unique and loving person."
  },
  {
    "id": "public:p-42d582cecffdf3888c5c",
    "category": "follow-through",
    "text": "Do it now"
  },
  {
    "id": "public:p-6a05e69a8bd51adc5a8c",
    "category": "follow-through",
    "text": "I am confident in my abilities to succeed"
  },
  {
    "id": "public:p-f0a89caa73553e90abb5",
    "category": "follow-through",
    "text": "I am relaxed"
  },
  {
    "id": "public:p-4951ea998be323c34376",
    "category": "follow-through",
    "text": "I like a challenge"
  },
  {
    "id": "public:p-c71cdb58a3525a960b9d",
    "category": "follow-through",
    "text": "I keep going"
  },
  {
    "id": "public:p-fabaaa270db53b59a872",
    "category": "follow-through",
    "text": "I like myself"
  },
  {
    "id": "public:p-28a421cffd73ff0d9416",
    "category": "follow-through",
    "text": "I will do it now"
  },
  {
    "id": "public:p-8337277145c573dbd4e9",
    "category": "follow-through",
    "text": "Start it now"
  },
  {
    "id": "public:p-5d89863256a84a4b46a0",
    "category": "follow-through",
    "text": "I am good at my job"
  },
  {
    "id": "public:p-3bc01ce5ca1d523594f2",
    "category": "follow-through",
    "text": "I want to succeed"
  },
  {
    "id": "public:p-075a43bacc694826f606",
    "category": "follow-through",
    "text": "Success starts now"
  },
  {
    "id": "public:p-d6ff20436e5e6cd413f2",
    "category": "follow-through",
    "text": "I feel energies"
  },
  {
    "id": "public:p-40fb039cf495ec463fa5",
    "category": "gratitude",
    "text": "My friends and colleagues appreciate me"
  },
  {
    "id": "public:p-c2d079e16dc5021c3ae5",
    "category": "gratitude",
    "text": "I like what I do"
  },
  {
    "id": "public:p-772245d39666b0badda3",
    "category": "gratitude",
    "text": "I am rewarded for the work I do"
  },
  {
    "id": "public:p-4816a27ae0324e026b2e",
    "category": "gratitude",
    "text": "I am happy content"
  },
  {
    "id": "public:p-e368671047ade61b108d",
    "category": "gratitude",
    "text": "I am healthy"
  },
  {
    "id": "public:p-6361365efc2d2ec87a5f",
    "category": "gratitude",
    "text": "My life is exciting"
  },
  {
    "id": "public:p-249256e93c635e3b9aed",
    "category": "gratitude",
    "text": "Everything is coming to me easily and effortlessly"
  },
  {
    "id": "public:p-ea2fc93e8518a3864ef7",
    "category": "gratitude",
    "text": "I now image only that which is for my highest good"
  },
  {
    "id": "public:p-771b0cec442d383e8a4d",
    "category": "gratitude",
    "text": "I know what I image will come to me"
  },
  {
    "id": "public:p-aea7474f5d24ec12577d",
    "category": "gratitude",
    "text": "When I set and vision goals I expect guidance"
  },
  {
    "id": "public:p-aaa8539ab70669e43dc9",
    "category": "gratitude",
    "text": "I am getting clear on what I am meant to be doing with my life"
  },
  {
    "id": "public:p-9f925cce7fcd2bd6d43f",
    "category": "purpose",
    "text": "I am one with all things, I am beauty, love, peace and harmony."
  },
  {
    "id": "public:p-dee60882cec590c5f5be",
    "category": "purpose",
    "text": "I love life, and life loves me."
  },
  {
    "id": "public:p-f420357da38c77de4c45",
    "category": "purpose",
    "text": "I am now aligning with my greater good."
  },
  {
    "id": "public:p-4bf9f16ff153a07b0216",
    "category": "purpose",
    "text": "I live in an abundant universe, I can have it all."
  },
  {
    "id": "public:p-ef4c5a70db1c5182cdab",
    "category": "purpose",
    "text": "I give thanks this day to all the wonderful things that await me."
  },
  {
    "id": "public:p-69f9688ed1e8530bf3d4",
    "category": "purpose",
    "text": "I await my greatest good with anticipation and joy."
  },
  {
    "id": "public:p-3ea31101ec8d2837fba0",
    "category": "purpose",
    "text": "Each day my life is filled with wonders and magic."
  },
  {
    "id": "public:p-febcc2272250d6f32aef",
    "category": "purpose",
    "text": "I feel my divine connection to everyone and everything."
  },
  {
    "id": "public:p-9a08c4a9f4e60ed1db32",
    "category": "purpose",
    "text": "The light of God is guiding me in everything I do."
  },
  {
    "id": "public:p-55cdfb7af73baff757f2",
    "category": "purpose",
    "text": "Every step I take leads me toward my Life Purpose."
  },
  {
    "id": "public:p-bb97b508f4062ca56734",
    "category": "purpose",
    "text": "I now surrender to the will of God"
  },
  {
    "id": "public:p-9a22f54a598c9e6e1465",
    "category": "purpose",
    "text": "Divine guidance is with me always"
  },
  {
    "id": "public:p-e2465c46def556e61ea0",
    "category": "purpose",
    "text": "I now let miracles happen"
  },
  {
    "id": "public:p-9c5cd76ccb82f489beda",
    "category": "purpose",
    "text": "Divine wisdom unfolds within me now."
  },
  {
    "id": "public:p-4ed79330645c3bc47547",
    "category": "purpose",
    "text": "I am now filled with the light and love of God."
  },
  {
    "id": "public:p-62b26a07d48d363ca628",
    "category": "purpose",
    "text": "Everything I seek is seeking me now."
  },
  {
    "id": "public:p-fe1d53370432c38b20d4",
    "category": "purpose",
    "text": "I now call on the light of God to guide me."
  },
  {
    "id": "public:p-3dfd6550f847ab383312",
    "category": "purpose",
    "text": "I am totally one with God."
  },
  {
    "id": "public:p-a071279fa72f9fe848da",
    "category": "purpose",
    "text": "I choose to experience things that reveal my true Life Purpose."
  },
  {
    "id": "public:p-ac403789010271a4f2d1",
    "category": "purpose",
    "text": "I am now acting upon my Life Purpose with joy and passion."
  },
  {
    "id": "public:p-be695a3f0b5b2368ec6a",
    "category": "purpose",
    "text": "I now accept that my Life Purpose is to love myself others."
  },
  {
    "id": "public:p-102215aff48ff9bae685",
    "category": "purpose",
    "text": "I am now free to do the things I love."
  },
  {
    "id": "public:p-03ec703e2730a2d87220",
    "category": "purpose",
    "text": "I choose to do the things I love."
  },
  {
    "id": "public:p-38a131d766315c54d42a",
    "category": "purpose",
    "text": "I am fulfilled as a person."
  },
  {
    "id": "public:p-e9c71befe6dcc16d21c0",
    "category": "purpose",
    "text": "I am clear on my goals and have the strength to follow through on them."
  },
  {
    "id": "public:p-3b97ab517504b461c793",
    "category": "purpose",
    "text": "I am in a constant state of fulfillment."
  },
  {
    "id": "public:p-88cedd9e7783787105d6",
    "category": "purpose",
    "text": "I am certain that my path is always perfect for me"
  },
  {
    "id": "public:p-8d9fc943a75b083480a1",
    "category": "perspective",
    "text": "I am open to do what the universe would have me do."
  },
  {
    "id": "public:p-abfc94c79bd105096b13",
    "category": "perspective",
    "text": "I am open to receive the guidance of the universe."
  },
  {
    "id": "public:p-4e7469a284500db143e1",
    "category": "perspective",
    "text": "I am now divinely guided in all my ways."
  },
  {
    "id": "public:p-b64bab690dcf860c5262",
    "category": "perspective",
    "text": "All things are coming together for the greatest good."
  },
  {
    "id": "public:p-85f4be267ee4ccc3d1a4",
    "category": "perspective",
    "text": "My greatest good is being revealed to me now."
  },
  {
    "id": "public:p-b54c4e0dc0eccec1e971",
    "category": "perspective",
    "text": "I look only go God for guidance."
  },
  {
    "id": "public:p-7a621ac10a7922365523",
    "category": "perspective",
    "text": "I now have a clear and open connection to my inner guidance."
  },
  {
    "id": "public:p-a8b5b1c40a3783583bd1",
    "category": "perspective",
    "text": "God's light goes before me making clear my way."
  },
  {
    "id": "public:p-d98c061dc9842a324b41",
    "category": "perspective",
    "text": "I am a channel for creative expression."
  },
  {
    "id": "public:p-bdddc6457454519ea4bd",
    "category": "perspective",
    "text": "I now tune in and receive guidance from my inner guides"
  },
  {
    "id": "public:p-3e4190f8c6f9b067d9e2",
    "category": "perspective",
    "text": "I listen to and act on inner guidance when the feeling is positive."
  },
  {
    "id": "public:p-45b300e28ff61551fe4a",
    "category": "perspective",
    "text": "I now look for the good in myself and others"
  },
  {
    "id": "public:p-7a46c45f80e91f728983",
    "category": "perspective",
    "text": "I judge nothing that happens today"
  },
  {
    "id": "public:p-0a50b4f7ff3af5ddf2a1",
    "category": "perspective",
    "text": "I now have a clear and open connection with my higher self"
  },
  {
    "id": "public:p-c1c4cd721b50d140d5fd",
    "category": "perspective",
    "text": "I now forgive all those who may have harmed me"
  },
  {
    "id": "public:p-2e379506b313a49de8a2",
    "category": "perspective",
    "text": "I accept only that which comes for love as being true"
  },
  {
    "id": "public:p-a7f7a92e4464d1ae9755",
    "category": "perspective",
    "text": "I open to the divine when I see the good on others"
  },
  {
    "id": "public:p-c5f6e50c7cdf5ee9c497",
    "category": "perspective",
    "text": "I now give love to my fellow beings"
  },
  {
    "id": "public:p-e9ea2e610e107531b811",
    "category": "perspective",
    "text": "When I fear, I accept I cannot see clear"
  },
  {
    "id": "public:p-cf250414d2e892aff5fc",
    "category": "perspective",
    "text": "I now choose love"
  },
  {
    "id": "public:p-98488e85b9e6f4d40e01",
    "category": "perspective",
    "text": "I now surrender all judgment's to God"
  },
  {
    "id": "public:p-cc49e220cd449aea2fd0",
    "category": "perspective",
    "text": "I now take time to be quite and listen to my still inner voice"
  },
  {
    "id": "public:p-041c101488a067458b49",
    "category": "perspective",
    "text": "I can do anything, I am divinely guided."
  },
  {
    "id": "public:p-465c38bd185f786ec56f",
    "category": "perspective",
    "text": "I look forward to change, change is good."
  },
  {
    "id": "public:p-44a878ddaf377da73986",
    "category": "perspective",
    "text": "I always speak my truth."
  },
  {
    "id": "public:p-afb2c8d475df33499411",
    "category": "perspective",
    "text": "I now focus on loving kindness with others"
  },
  {
    "id": "public:p-c1788acaa6b13f7b92b6",
    "category": "perspective",
    "text": "I have an abundance of love in my life."
  },
  {
    "id": "public:p-54cf1b6cc330e397e648",
    "category": "perspective",
    "text": "I now live a healthy and balance life."
  },
  {
    "id": "public:p-37eb4b730c7777242254",
    "category": "perspective",
    "text": "I now set and achieve my goals"
  },
  {
    "id": "public:p-de2f8af489a913a46c53",
    "category": "perspective",
    "text": "I accept compliments gracefully."
  },
  {
    "id": "public:p-d1760a375d7f319d9a6d",
    "category": "perspective",
    "text": "I am healthy, happy, and wise."
  },
  {
    "id": "public:p-b5b27db79020024ee102",
    "category": "perspective",
    "text": "I now attract lots of loving people into my life."
  },
  {
    "id": "public:p-5b0f79fb433bcc7e6453",
    "category": "perspective",
    "text": "I am now open to receive love."
  },
  {
    "id": "public:p-fce74ccfe84e553cddd1",
    "category": "follow-through",
    "text": "I am committed to doing what I say I will do"
  },
  {
    "id": "public:p-0b6fe1424bd8187b4956",
    "category": "follow-through",
    "text": "When I commit to something I always see it though"
  },
  {
    "id": "public:p-ca34a42924aaf1d1ab09",
    "category": "follow-through",
    "text": "I schedule tasks and commit to carrying them out"
  },
  {
    "id": "public:p-9f3c0345ecfdf11a288b",
    "category": "follow-through",
    "text": "I love the challenge of seeing ________through to completion"
  },
  {
    "id": "public:p-3934d57e82c6e345bec9",
    "category": "follow-through",
    "text": "If something needs doing, I DO IT..."
  },
  {
    "id": "public:p-bc7d0bc1aa25b7d2ad44",
    "category": "follow-through",
    "text": "I am committed to being the best ME! I can"
  },
  {
    "id": "public:p-d3edd5bc6531b0003955",
    "category": "follow-through",
    "text": "I can do anything I commit to"
  },
  {
    "id": "public:p-5445caf6a6085e7e9262",
    "category": "follow-through",
    "text": "I have great inner resources that I call on when required"
  },
  {
    "id": "public:p-d70e87d2d116439373f8",
    "category": "follow-through",
    "text": "I can do anything I set my mind to"
  },
  {
    "id": "public:p-de5a463eaae5d6d6b921",
    "category": "follow-through",
    "text": "When I commit to doing something I allways see it through"
  },
  {
    "id": "public:p-8c0d0f5f11d96ea2f36c",
    "category": "follow-through",
    "text": "When something needs doing, I jump up and do it"
  },
  {
    "id": "public:p-5da6c65c5345c869d16d",
    "category": "follow-through",
    "text": "When I make a commitment I am unstoppable"
  },
  {
    "id": "public:p-a57e86eade1309fc3817",
    "category": "work",
    "text": "I now see myself successfully making sales."
  },
  {
    "id": "public:p-efee242e11c48e0d60c1",
    "category": "work",
    "text": "I am confident and at ease."
  },
  {
    "id": "public:p-61c8e185a687052772b9",
    "category": "work",
    "text": "What I imagine I can do I can do."
  },
  {
    "id": "public:p-e8e06d83631a088dd3b9",
    "category": "work",
    "text": "I am a self-motivated person."
  },
  {
    "id": "public:p-0a8ebc6c4c1c5622ffcb",
    "category": "work",
    "text": "I am an outgoing and friendly person."
  },
  {
    "id": "public:p-09721b76347b6cfa531f",
    "category": "work",
    "text": "I always say the right thing."
  },
  {
    "id": "public:p-c0f2b7c066b0472e65cb",
    "category": "work",
    "text": "I now put others at ease."
  },
  {
    "id": "public:p-f7868de7a3180456fe9d",
    "category": "work",
    "text": "I come across as a sincere person."
  },
  {
    "id": "public:p-ed94c83fb2a889ba252e",
    "category": "work",
    "text": "My sales figures are increasing."
  },
  {
    "id": "public:p-38f58c84f48affc50120",
    "category": "work",
    "text": "I am a very confident salesperson."
  },
  {
    "id": "public:p-63435e6c781f7df88f41",
    "category": "work",
    "text": "I approach selling with an optimistic attitude."
  },
  {
    "id": "public:p-ec3df2615e16ee54416f",
    "category": "work",
    "text": "I can be the best in my field, I have what it takes."
  },
  {
    "id": "public:p-6e65ba017636be5b1fe9",
    "category": "learning",
    "text": "I do remember names and faces"
  },
  {
    "id": "public:p-85231767c0b291740538",
    "category": "learning",
    "text": "I do remember facts"
  },
  {
    "id": "public:p-ae5996b7adaf35ec9022",
    "category": "learning",
    "text": "I do remember figures"
  },
  {
    "id": "public:p-8d13de86dad33cb23927",
    "category": "learning",
    "text": "I do spend time trying to remember"
  },
  {
    "id": "public:p-b561bd72dd67f6852fa2",
    "category": "learning",
    "text": "I do remember things which are important"
  },
  {
    "id": "public:p-c04837a2229e510b0569",
    "category": "learning",
    "text": "I do remember to fulfill my obligations"
  },
  {
    "id": "public:p-13454954af0055a5885f",
    "category": "learning",
    "text": "I do become better at remembering"
  },
  {
    "id": "public:p-f65d77694a406e743386",
    "category": "learning",
    "text": "I am good at remembering"
  },
  {
    "id": "public:p-f509d3d344c258a51f2e",
    "category": "learning",
    "text": "My memory is excellent"
  },
  {
    "id": "public:p-93bf83617e6e914e707c",
    "category": "learning",
    "text": "My learning abilities are increasing"
  },
  {
    "id": "public:p-b31862d633264d872bec",
    "category": "learning",
    "text": "I now love to learn."
  },
  {
    "id": "public:p-ed0191a6fffba15bfdc7",
    "category": "learning",
    "text": "Learning is fun and easy."
  },
  {
    "id": "public:p-bf63e876b1d2659563dd",
    "category": "learning",
    "text": "I absorb all learning material."
  },
  {
    "id": "public:p-df085ca935df2dbdafd2",
    "category": "learning",
    "text": "I soak up information."
  },
  {
    "id": "public:p-f1548c79f428ab8cc7d0",
    "category": "learning",
    "text": "I am a creative genius."
  },
  {
    "id": "public:p-ce8831a616a9c168da9c",
    "category": "learning",
    "text": "I easily learn every subject I choose."
  },
  {
    "id": "public:p-6cbac3fce233dbf0b568",
    "category": "learning",
    "text": "I now obtain excellent result in all examinations."
  },
  {
    "id": "public:p-0991e8412645a7f57a14",
    "category": "learning",
    "text": "I am at ease in exams."
  },
  {
    "id": "public:p-118f707318488f62b4e7",
    "category": "learning",
    "text": "I have easy recall of all learned information"
  },
  {
    "id": "public:p-52cfa6d2f52b173cb06c",
    "category": "learning",
    "text": "I attract to me all I need"
  },
  {
    "id": "public:p-73b978a095390f26c232",
    "category": "learning",
    "text": "I have easy access to subconscious information"
  },
  {
    "id": "public:p-d6fe1ebc1e7efe5a8c2e",
    "category": "learning",
    "text": "I set goals and achieve them"
  },
  {
    "id": "public:p-7a8128378ac86c481bca",
    "category": "learning",
    "text": "All subconscious information is being revealed to me now"
  },
  {
    "id": "public:p-405c9b42720876465640",
    "category": "work",
    "text": "Success for the group is important"
  },
  {
    "id": "public:p-e09a9ffa0a1febe052d9",
    "category": "work",
    "text": "I can delegate well"
  },
  {
    "id": "public:p-69c2ac0d2882c5fe44cb",
    "category": "work",
    "text": "I can depend on my team members"
  },
  {
    "id": "public:p-e45c9570243e20e8e000",
    "category": "work",
    "text": "I like working in a team"
  },
  {
    "id": "public:p-326bb63ac6fad6929a74",
    "category": "work",
    "text": "I achieve more with a team"
  },
  {
    "id": "public:p-d2958741fbf86c53b126",
    "category": "work",
    "text": "Teamwork is fun"
  },
  {
    "id": "public:p-99a4e2fad7d76173a547",
    "category": "work",
    "text": "I forgive other people's weaknesses"
  },
  {
    "id": "public:p-2375bd41b6d6f6be606f",
    "category": "work",
    "text": "I am good at coordinating people"
  },
  {
    "id": "public:p-fa150d0a0260ada840a3",
    "category": "work",
    "text": "I accept my role in the group"
  },
  {
    "id": "public:p-6d4466d54d3c7fd05d8b",
    "category": "self-kindness",
    "text": "I achieve my weight loss goals"
  },
  {
    "id": "public:p-6703c7cad10d1f81cebc",
    "category": "self-kindness",
    "text": "Losing weight comes naturally to me"
  },
  {
    "id": "public:p-d1c6eb27163a8cdf92ee",
    "category": "self-kindness",
    "text": "I choose nourishing, healthy foods"
  },
  {
    "id": "public:p-00408dfba8ebef2d6132",
    "category": "self-kindness",
    "text": "I think before eating"
  },
  {
    "id": "public:p-d6141c4e11462c185f0d",
    "category": "self-kindness",
    "text": "I drink lots of water"
  },
  {
    "id": "public:p-f542a8da7c88e56f91ec",
    "category": "self-kindness",
    "text": "Losing weight is fun"
  },
  {
    "id": "public:p-0c022da059e9dfae1113",
    "category": "self-kindness",
    "text": "Healthy foods taste better"
  },
  {
    "id": "public:p-07363cc978bd79066e39",
    "category": "self-kindness",
    "text": "I am motivated by both successes and failures"
  },
  {
    "id": "public:p-3fdbb4f93383992d6b6a",
    "category": "self-kindness",
    "text": "I accept and love my body as it is, and work to make it better"
  },
  {
    "id": "public:p-4fb805322d89a092fadd",
    "category": "self-kindness",
    "text": "I love challenges and embrace them"
  },
  {
    "id": "public:p-25d610022a9b1f2d2b5e",
    "category": "self-kindness",
    "text": "I lose weight systematically and I keep it off permanently"
  },
  {
    "id": "public:p-e56c6187a774dde9cf5b",
    "category": "self-kindness",
    "text": "I am losing weight"
  },
  {
    "id": "public:p-ebbba436ead7d8ef2ee6",
    "category": "self-kindness",
    "text": "I exercise because it makes me feel good"
  },
  {
    "id": "public:p-5a6b0a51c9595351ef89",
    "category": "self-kindness",
    "text": "I respect my body and treat it with respect"
  },
  {
    "id": "public:p-0110a0312b7337cfd399",
    "category": "self-kindness",
    "text": "I do everything I need to do to achieve my healthy weight"
  },
  {
    "id": "public:p-8af38ff9617abc06ee24",
    "category": "self-kindness",
    "text": "I am encouraged by every success"
  },
  {
    "id": "public:p-32d7ac270728722c27ee",
    "category": "self-kindness",
    "text": "I am motivated by every shortfall"
  },
  {
    "id": "public:p-3498e7e4574e108a7625",
    "category": "self-kindness",
    "text": "Losing weight and I are one"
  },
  {
    "id": "public:p-5a9d0a310494c97403ac",
    "category": "self-kindness",
    "text": "I dissolve all blocks to reaching a healthy weight"
  },
  {
    "id": "public:p-56cb39c601ec43d1af64",
    "category": "self-kindness",
    "text": "I learn from my mistakes"
  },
  {
    "id": "public:p-0f6a30b8daf2644f830c",
    "category": "self-kindness",
    "text": "I fill all physical appetites in physically healthy ways"
  },
  {
    "id": "public:p-f7dbf39f738a45b197f7",
    "category": "self-kindness",
    "text": "I am aware of my eating habits and how they affect my weight"
  },
  {
    "id": "public:p-442f1fb0a25a96affa94",
    "category": "self-kindness",
    "text": "I am willing to change my eating habits and I do so easily"
  },
  {
    "id": "public:p-7b87fa81c67247ae08d2",
    "category": "self-kindness",
    "text": "I build lean muscle and I lose fat"
  },
  {
    "id": "public:p-66fb4757125f9f167960",
    "category": "self-kindness",
    "text": "I enjoy the process of reaching a healthy weight"
  },
  {
    "id": "public:p-ce732f9626612e343616",
    "category": "self-kindness",
    "text": "I see myself at my healthy weight and I achieve it"
  },
  {
    "id": "public:p-6cc025d162dedadb2505",
    "category": "self-kindness",
    "text": "I have non-stop daily determination to reach my healthy weight"
  },
  {
    "id": "public:p-02408dff3af506aec7d5",
    "category": "self-kindness",
    "text": "I like long walks"
  },
  {
    "id": "public:p-b7c837192c8b16a5ad4c",
    "category": "self-kindness",
    "text": "It is easy for me to stay on my plan to obtain my healthy weight"
  },
  {
    "id": "public:p-f9fed6bf9a7d1c2d7d45",
    "category": "self-kindness",
    "text": "I picture myself at my perfect weight"
  },
  {
    "id": "public:p-0af2659149cddb317e44",
    "category": "self-kindness",
    "text": "I have a positive attitude about what I eat, how I eat, and when I eat"
  },
  {
    "id": "public:p-36fa2bd9de7701f93072",
    "category": "self-kindness",
    "text": "My body burns fat like a furnace"
  },
  {
    "id": "public:p-7e462a9c3b868284e883",
    "category": "self-kindness",
    "text": "Developing healthy eating habits becomes easier each day"
  },
  {
    "id": "public:p-badf86d6c02504700c59",
    "category": "self-kindness",
    "text": "I stay on a healthy eating plan and maintain my healthy weight easily"
  },
  {
    "id": "public:p-e685031a72931540651d",
    "category": "self-kindness",
    "text": "Each day, I automatically and successfully get healthier and healthier"
  },
  {
    "id": "public:p-870fbce08238cb3f9b57",
    "category": "self-kindness",
    "text": "I am becoming slimmer"
  },
  {
    "id": "public:p-9306191f61dfb1f6b4de",
    "category": "self-kindness",
    "text": "I am energetic"
  },
  {
    "id": "public:p-9820a1764981f4236288",
    "category": "self-kindness",
    "text": "My health is important"
  },
  {
    "id": "public:p-a3f3adaa617909ae9999",
    "category": "self-kindness",
    "text": "I can achieve a balanced lifestyle"
  },
  {
    "id": "public:p-7ef475287f8bae3e596f",
    "category": "self-kindness",
    "text": "I like to exercise"
  },
  {
    "id": "public:p-4700174445307923179f",
    "category": "self-kindness",
    "text": "I exercise often"
  },
  {
    "id": "public:p-182897266eb2cc1c8ac5",
    "category": "self-kindness",
    "text": "I am reaching my ideal weight"
  },
  {
    "id": "public:p-4a303d997bb92ad7943a",
    "category": "self-kindness",
    "text": "I like eating healthy food"
  },
  {
    "id": "public:p-fd547bc10c991f093ba5",
    "category": "self-kindness",
    "text": "Sour food is more interesting"
  },
  {
    "id": "public:p-ab4748310c156195ebe4",
    "category": "self-kindness",
    "text": "I like sour food"
  },
  {
    "id": "public:p-5b8b3af8eba337c93685",
    "category": "self-kindness",
    "text": "I respect my body"
  },
  {
    "id": "public:p-d11842bc0caf71a1e68d",
    "category": "self-kindness",
    "text": "Other people respect me"
  },
  {
    "id": "public:p-7e04146d6f6ada0ee06a",
    "category": "self-kindness",
    "text": "I am achieving a healthy weight"
  }
];
  const data = {categories: Object.fromEntries(groups.map(([id, label]) => [id, label])), lines: [...publicLines, ...groups.flatMap(([category, , lines]) => lines.map((text, i) => ({id: `starter:${category}:${i + 1}`, category, text, archived: true})))]};
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.ocfAffirmationsData = data;
})(globalThis);
