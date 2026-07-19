// Textos para el minijuego True or False (Grade 4 · Unit 4).
// Cada texto tiene título, párrafo y 6 afirmaciones con su respuesta.
export const trueOrFalseTexts = [
  {
    id: 'text_1',
    title: 'I Went to the Doctor',
    text: `Yesterday I was playing soccer in the park when I fell down. My arm really hurts!
When I was coming home it was raining and I got wet. My mom gave me an aspirin because I had a terrible headache.
My mom took me to the doctor's office. First, we sat in the waiting room for about ten minutes. Then, a nurse called me and took my blood pressure. After that, she asked me some questions.
Finally, when the doctor came into the room, he listened to my heart. He examined my arm, eyes, my throat and other parts of my body. He also took my temperature and he took an X-ray of my arm. He was a very nice doctor.
My mom and I waited for some minutes and then the doctor called us. He had bad news for us. I broke my arm!
After the visit to the doctor's office, my mom and I went to Pops and she bought me an ice cream. I was happy to know that I won't go to school for a while.`,
    statements: [
      { text: 'The child was playing basketball in the park.',    answer: false },
      { text: 'The mom gave the child an aspirin for a headache.', answer: true },
      { text: "The nurse took the child's blood pressure.",       answer: true },
      { text: 'The doctor examined only the arm.',                answer: false },
      { text: 'The child broke his arm.',                         answer: true },
      { text: 'After the doctor, they went to eat ice cream.',    answer: true }
    ]
  },
  {
    id: 'text_2',
    title: 'Maria Has the Flu',
    text: `Maria is not feeling well today. She has a fever and a bad cough. Her head hurts a lot. Her mom thinks she has the flu.
Maria's mom called the doctor. The doctor said Maria needs to rest and drink a lot of water. He also said she should take some pills three times a day.
Maria is in bed now. She is watching television and drinking hot tea with honey. Her mom says that natural medicine can help too.
Maria's friends called her. They said "Get well soon, Maria!" Maria hopes she feels better tomorrow so she can go back to school.`,
    statements: [
      { text: 'Maria has a cold.',                                 answer: false },
      { text: 'Maria has a fever and a cough.',                    answer: true },
      { text: 'The doctor visited Maria at home.',                 answer: false },
      { text: 'The doctor said Maria should drink a lot of water.', answer: true },
      { text: 'Maria is taking pills once a day.',                 answer: false },
      { text: "Maria's friends called her.",                       answer: true }
    ]
  },
  {
    id: 'text_3',
    title: 'At the Pharmacy',
    text: `Tom has a stomachache and a sore throat. His dad took him to the pharmacy after the doctor visit.
At the pharmacy, the pharmacist was very helpful. She read Tom's prescription carefully. Tom needs three medicines: tablets for his stomach, a cream for a small rash on his arm, and vitamins to get stronger.
The pharmacist explained: "Take one tablet every eight hours. Take it with food or milk. Put the cream on your arm two times a day."
Tom's dad paid for the medicines. They thanked the pharmacist and went home. Tom followed the instructions and in three days he felt much better.`,
    statements: [
      { text: 'Tom has a headache and a sore throat.',            answer: false },
      { text: 'Tom went to the pharmacy with his dad.',           answer: true },
      { text: 'Tom needs to take two medicines.',                 answer: false },
      { text: 'Tom should take one tablet every eight hours.',    answer: true },
      { text: 'Tom should take the tablet without food.',         answer: false },
      { text: 'Tom felt better after three days.',                answer: true }
    ]
  },
  {
    id: 'text_4',
    title: 'Staying Healthy',
    text: `Doctor López talks to her patients every week about how to stay healthy. She says there are simple things we can do every day.
First, you should wash your hands frequently, especially before eating. Second, you should drink eight glasses of water every day. Third, you should sleep eight hours every night.
Doctor López also says you should exercise every day. Walking, running, or playing sports are great options. You should also eat fruits and vegetables.
If you feel sick, you should visit a doctor right away. You should not wait too long. Remember: an apple a day keeps the doctor away!`,
    statements: [
      { text: 'Doctor López says you should wash your hands before eating.', answer: true },
      { text: 'You should drink ten glasses of water every day.',   answer: false },
      { text: 'You should sleep eight hours every night.',          answer: true },
      { text: 'Doctor López says you should not exercise.',         answer: false },
      { text: 'You should visit a doctor if you feel sick.',        answer: true },
      { text: 'Eating vegetables helps you stay healthy.',          answer: true }
    ]
  },
  {
    id: 'text_5',
    title: 'Dengue Fever',
    text: `Dengue fever is a disease that comes from mosquito bites. When a mosquito bites a person who has dengue, it can pass the disease to the next person it bites.
The symptoms of dengue are: high fever, terrible headache, pain in the joints, and sometimes a rash on the skin. Some people also feel very tired and have no appetite.
To prevent dengue, you should eliminate standing water around your house because mosquitoes breed in water. You should also use mosquito repellent and wear long sleeves.
If you think you have dengue, you should visit a doctor immediately. The doctor will take your temperature and do a blood test to check if you have dengue.`,
    statements: [
      { text: 'Dengue fever comes from drinking bad water.',      answer: false },
      { text: 'Mosquitoes can pass dengue to people.',           answer: true },
      { text: 'A headache is a symptom of dengue.',              answer: true },
      { text: 'Mosquitoes breed in standing water.',             answer: true },
      { text: 'You should visit a doctor if you think you have dengue.', answer: true },
      { text: 'A rash is never a symptom of dengue.',            answer: false }
    ]
  },
  {
    id: 'text_6',
    title: 'The School Nurse',
    text: `Every school has a nurse. The school nurse helps students when they feel sick during the day.
When a student has a stomachache or headache, they go to the nurse's office. The nurse checks the student's temperature and asks about the symptoms.
If the student has a fever over 38 degrees, the nurse calls the parents. The parents come to take the student home to rest.
The nurse also teaches students about health. She explains how to wash hands correctly and how to sneeze into your elbow. This helps prevent the spread of diseases in school.`,
    statements: [
      { text: 'The school nurse helps sick students.',            answer: true },
      { text: 'The nurse gives students their grades.',          answer: false },
      { text: 'If a student has a high fever, the nurse calls the parents.', answer: true },
      { text: 'Students should sneeze into their hands.',        answer: false },
      { text: 'The nurse checks the temperature of sick students.', answer: true },
      { text: 'Washing hands helps prevent diseases at school.', answer: true }
    ]
  }
]
