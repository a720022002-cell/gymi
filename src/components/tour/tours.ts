/** One card of a tour: what it points at (a TourTarget id; none shows it in the middle) and what it says. */
export type TourStep = { target?: string; title: string; body: string };
export type TourId = 'home' | 'food' | 'train' | 'progress' | 'friends';

/** The tour of each tab, shown the first time the tab opens. */
export const TOURS: Record<TourId, TourStep[]> = {
  home: [
    {
      target: 'tabs',
      title: 'Five sections',
      body: 'Home, Food, Train, Progress and Gym Bros. Tap one to switch.',
    },
    {
      target: 'coach',
      title: 'Your AI coach',
      body: 'Ask anything: what to eat, how to train today, why your weight is stuck. It knows your plan and your numbers.',
    },
    {
      target: 'home.main',
      title: 'Today at a glance',
      body: 'Calories, protein and water for today. Tap it for the details.',
    },
    {
      target: 'home.days',
      title: 'Any day',
      body: 'Tap a day to see what you ate and trained. The calendar opens older days.',
    },
    {
      target: 'home.you',
      title: 'You and your settings',
      body: 'Your profile, Apple Health and devices like WHOOP or Oura, reminders, language and privacy.',
    },
  ],
  food: [
    {
      target: 'food.add',
      title: 'Log food',
      body: 'Tap + to log a meal: take a photo, scan a barcode, search, or just type what you ate.',
    },
    {
      target: 'food.summary',
      title: 'What’s left today',
      body: 'What you ate against today’s goal, with protein, carbs and fat. Workouts and cardio add to it.',
    },
    {
      target: 'food.bell',
      title: 'Meal reminders',
      body: 'Turn on reminders so you don’t forget to log your meals.',
    },
    {
      target: 'food.days',
      title: 'Other days',
      body: 'Pick a day to log or check a meal you had earlier.',
    },
  ],
  train: [
    {
      target: 'train.week',
      title: 'Your week',
      body: 'Your training days this week. Done days get a check.',
    },
    {
      target: 'train.workout',
      title: 'Today’s workout',
      body: 'Tap Start and log each set. Adro suggests the weight for every set and times your rest.',
    },
    {
      target: 'train.plan',
      title: 'Your plan',
      body: 'See your whole week, move a workout to another day, or change exercises.',
    },
    {
      target: 'train.bell',
      title: 'Workout reminder',
      body: 'Get a reminder at the time you usually train.',
    },
  ],
  progress: [
    {
      target: 'progress.tabs',
      title: 'Four views',
      body: 'Overall, Body, Recovery and Streaks. Tap any card to open its page with charts and Adro’s analysis.',
    },
    {
      target: 'progress.reports',
      title: 'Reports',
      body: 'A report for a week, a month or any dates you pick, to keep or share with your coach or doctor.',
    },
  ],
  friends: [
    {
      target: 'friends.add',
      title: 'Add friends',
      body: 'Add friends by username or send them your invite link.',
    },
    {
      target: 'friends.tabs',
      title: 'Train together',
      body: 'Your friends, groups and challenges, and what everyone did. Start a group workout or a challenge from here.',
    },
  ],
};
