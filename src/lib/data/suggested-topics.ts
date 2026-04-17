export interface TopicCategory {
	name: string;
	topics: string[];
}

export const suggestedTopics: TopicCategory[] = [
	{
		name: 'Art & Design',
		topics: ['art', 'illustration', 'drawing', 'painting', 'watercolor', 'sketches', 'typography', 'graphic design']
	},
	{
		name: 'Fashion & Beauty',
		topics: ['fashion', 'streetwear', 'outfits', 'vintage style', 'sneakers', 'makeup', 'hairstyles', 'nails', 'tattoos']
	},
	{
		name: 'Home & Garden',
		topics: ['home decor', 'interior design', 'minimalism', 'gardening', 'architecture', 'plants', 'bedroom ideas']
	},
	{
		name: 'Food & Drink',
		topics: ['recipes', 'desserts', 'coffee', 'baking', 'cocktails', 'healthy meals']
	},
	{
		name: 'Travel & Outdoors',
		topics: ['travel', 'nature', 'hiking', 'camping', 'landscapes', 'beach', 'mountains']
	},
	{
		name: 'Hobbies',
		topics: ['photography', 'diy', 'crafts', 'gaming', 'books', 'music', 'guitar', 'knitting']
	},
	{
		name: 'Wellness & Fitness',
		topics: ['fitness', 'yoga', 'workouts', 'skincare', 'self care', 'running']
	},
	{
		name: 'Aesthetic',
		topics: ['aesthetic', 'wallpapers', 'cottagecore', 'dark academia', 'y2k', 'retro', 'minimalist']
	},
	{
		name: 'Sports',
		topics: ['baseball', 'basketball', 'soccer', 'football', 'skateboarding', 'surfing']
	},
	{
		name: 'Pop Culture',
		topics: ['anime', 'manga', 'comics', 'movies', 'memes', 'kpop', 'cosplay']
	},
	{
		name: 'Animals',
		topics: ['dogs', 'cats', 'cute animals', 'birds', 'horses']
	},
	{
		name: 'Cars & Tech',
		topics: ['cars', 'motorcycles', 'tech', 'gadgets', 'pc setup']
	}
];
