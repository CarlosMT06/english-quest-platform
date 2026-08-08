// Instrucciones por minijuego, como lista de pasos (inglés primero, luego español).
// Se muestran en el modal del botón "?" del HUD.
export const INSTRUCTIONS = {
  // Versión espacial (dentro del mapa): el jugador se mueve y agarra la
  // cartulina correcta. Distinta del 'listen-choose' de UI de abajo.
  'listen-choose-spatial': {
    en: [
      'Walk up to the tables — a word plays automatically each round.',
      'Press Q at any time to hear the word again.',
      'Read the cards on the tables and find the one that matches the word.',
      'Stand next to the correct card and press the grab key to pick it up.',
      'If you grab the wrong card it stays on the table — try another one.',
      'You have a set of hearts per round: each wrong grab costs one heart.',
      'Grab the correct card to win the round and move on to the next word.',
    ],
    es: [
      'Acérquese a las mesas — cada ronda suena una palabra automáticamente.',
      'Presione Q en cualquier momento para volver a escuchar la palabra.',
      'Lea las cartulinas de las mesas y busque la que coincide con la palabra.',
      'Póngase junto a la cartulina correcta y presione la tecla de agarrar para tomarla.',
      'Si agarra la cartulina equivocada, se queda en la mesa — pruebe otra.',
      'Tiene varios corazones por ronda: cada error le cuesta un corazón.',
      'Agarre la cartulina correcta para ganar la ronda y pasar a la siguiente palabra.',
    ],
  },
  // Versión espacial de Listen & Point: como listen-choose-spatial, pero las
  // cartulinas muestran una imagen en vez de la palabra escrita.
  'listen-point-spatial': {
    en: [
      'Walk up to the tables — a word plays automatically each round.',
      'Press Q at any time to hear the word again.',
      'Look at the pictures on the tables and find the one that matches the word.',
      'Stand next to the correct picture and press the grab key to pick it up.',
      'If you grab the wrong picture it stays on the table — try another one.',
      'You have a set of hearts per round: each wrong grab costs one heart.',
      'Grab the correct picture to win the round and move on to the next word.',
    ],
    es: [
      'Acérquese a las mesas — cada ronda suena una palabra automáticamente.',
      'Presione Q en cualquier momento para volver a escuchar la palabra.',
      'Mire las imágenes de las mesas y busque la que coincide con la palabra.',
      'Póngase junto a la imagen correcta y presione la tecla de agarrar para tomarla.',
      'Si agarra la imagen equivocada, se queda en la mesa — pruebe otra.',
      'Tiene varios corazones por ronda: cada error le cuesta un corazón.',
      'Agarre la imagen correcta para ganar la ronda y pasar a la siguiente palabra.',
    ],
  },
  'listen-choose': {
    en: [
      'Listen to the word that plays automatically.',
      'Press the speaker button if you want to hear it again.',
      'Tap the written option you think is correct.',
      'If you choose wrong, you can try again — but each mistake in a round lowers the points you earn for it.',
      'Answer correctly on your first try to earn the most points.',
    ],
    es: [
      'Escuche la palabra que suena automáticamente.',
      'Presione el botón de sonido si quiere volver a escucharla.',
      'Toque la opción escrita que crea correcta.',
      'Si se equivoca, puede intentar de nuevo — pero cada error en una ronda baja los puntos que gana por ella.',
      'Acierte a la primera para conseguir el máximo de puntos.',
    ],
  },
  'listen-image': {
    en: [
      'Listen to the word that plays automatically.',
      'Press the speaker button to hear it again if you need to.',
      'Tap the image that matches the word.',
      'If you choose wrong, you can try again — but each mistake in a round lowers the points you earn for it.',
      'Answer correctly on your first try to earn the most points.',
    ],
    es: [
      'Escuche la palabra que suena automáticamente.',
      'Presione el botón de sonido si necesita volver a escucharla.',
      'Toque la imagen que corresponde a la palabra.',
      'Si se equivoca, puede intentar de nuevo — pero cada error en una ronda baja los puntos que gana por ella.',
      'Acierte a la primera para conseguir el máximo de puntos.',
    ],
  },
  'memory-match': {
    en: [
      'All the cards start face down.',
      'Tap a card to flip it and see what is underneath.',
      'Flip a second card to look for its pair — each image matches a sentence.',
      'If the two cards match, they stay face up. If not, they flip back.',
      'Match all the pairs to finish the game.',
      'Tip: flip every card once to memorize them, then make the pairs.',
      'You lose points only when you flip a card you had already seen and it does not match.',
    ],
    es: [
      'Todas las cartas empiezan boca abajo.',
      'Toque una carta para voltearla y ver qué hay debajo.',
      'Voltee una segunda carta buscando su pareja — cada imagen coincide con una oración.',
      'Si las dos cartas coinciden, quedan boca arriba. Si no, se vuelven a voltear.',
      'Empareje todas las cartas para terminar el juego.',
      'Consejo: voltéelas todas una vez para memorizarlas y después arme las parejas.',
      'Solo pierde puntos cuando voltea una carta que ya había visto y no coincide.',
    ],
  },
  'true-false': {
    en: [
      'Read the text at the top carefully — it has all the answers.',
      'Read the statement shown below the text.',
      'Decide if it is True or False and tap that button.',
      'The text stays on screen, so you can check it whenever you want.',
      'You earn points for every statement you answer correctly.',
    ],
    es: [
      'Lea con atención el texto de arriba — tiene todas las respuestas.',
      'Lea la afirmación que aparece debajo del texto.',
      'Decida si es Verdadera (True) o Falsa (False) y toque ese botón.',
      'El texto se queda en pantalla, así que puede consultarlo cuando quiera.',
      'Gana puntos por cada afirmación que responda correctamente.',
    ],
  },
  'hangman': {
    en: [
      'A hidden word is shown as empty spaces, one for each letter.',
      'Choose letters using the on-screen keyboard or your own keyboard.',
      'Correct letters appear in the word; wrong letters draw part of the figure.',
      'Be careful: too many wrong letters and you lose the round.',
      'You earn points for the letters you guess correctly.',
    ],
    es: [
      'La palabra oculta se muestra como espacios vacíos, uno por cada letra.',
      'Elija letras con el teclado en pantalla o con el suyo.',
      'Las letras correctas aparecen en la palabra; las incorrectas dibujan parte de la figura.',
      'Cuidado: con demasiadas letras incorrectas pierde la ronda.',
      'Gana puntos por las letras que adivina correctamente.',
    ],
  },
  'fill-blank': {
    en: [
      'Look at the image — it is a clue for the missing word.',
      'Read the sentence with the blank space.',
      'Use the scrambled letters (tap them or type on your keyboard) to build the word.',
      'Press the ⌫ button to remove a letter if you make a mistake.',
      'If your word is wrong, you can try again — but each mistake in a round lowers the points you earn for it.',
      'Complete it correctly on the first try to earn the most points.',
    ],
    es: [
      'Mire la imagen — es una pista de la palabra que falta.',
      'Lea la oración con el espacio en blanco.',
      'Use las letras desordenadas (tocándolas o escribiendo en su teclado) para armar la palabra.',
      'Presione el botón ⌫ para quitar una letra si se equivoca.',
      'Si la palabra queda mal, puede intentar de nuevo — pero cada error en una ronda baja los puntos que gana por ella.',
      'Complétela bien a la primera para conseguir el máximo de puntos.',
    ],
  },
}
