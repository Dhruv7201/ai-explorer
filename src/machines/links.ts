/** Further reading: main links per machine, plus one link per station ("part"). */
export interface Link {
  title: string
  url: string
}
export interface MachineLinks {
  main: Link[]
  parts: Record<string, Link>
}

const wiki = (page: string, title = page.replace(/_/g, ' ')): Link => ({ title, url: `https://en.wikipedia.org/wiki/${page}` })
const arxiv = (id: string, title: string): Link => ({ title, url: `https://arxiv.org/abs/${id}` })
const doi = (id: string, title: string): Link => ({ title, url: `https://doi.org/${id}` })
const bbg = (slug: string, title: string): Link => ({ title, url: `https://blog.bytebytego.com/p/${slug}` })
const tds = (slug: string, title: string): Link => ({ title: `Towards Data Science: ${title}`, url: `https://towardsdatascience.com/${slug}/` })
const med = (path: string, title: string): Link => ({ title: `Medium: ${title}`, url: `https://${path}` })
const web = (url: string, title: string): Link => ({ title, url })

export const LINKS: Record<string, MachineLinks> = {
  eliza: {
    main: [web('https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf', 'Weizenbaum’s ELIZA paper (Stanford PDF)'), wiki('ELIZA'), doi('10.1145/365153.365168', 'Weizenbaum (1966): the original ELIZA paper')],
    parts: {
      you: wiki('Chatbot'),
      scanner: wiki('Pattern_matching'),
      patterns: wiki('Regular_expression'),
      swapper: wiki('ELIZA', 'How ELIZA reflects your words'),
      reply: wiki('ELIZA_effect'),
    },
  },
  'nearest-neighbours': {
    main: [tds('machine-learning-basics-with-the-k-nearest-neighbors-algorithm-6a6e71d01761', 'Machine learning basics with k-nearest neighbours'), wiki('K-nearest_neighbors_algorithm', 'k-nearest neighbours algorithm'), doi('10.1109/TIT.1967.1053964', 'Cover & Hart (1967): Nearest neighbor pattern classification')],
    parts: {
      email: wiki('Email_spam'),
      features: wiki('Feature_(machine_learning)', 'Features in machine learning'),
      memory: wiki('Instance-based_learning'),
      ruler: wiki('Euclidean_distance'),
      vote: wiki('Statistical_classification'),
      label: wiki('Supervised_learning'),
    },
  },
  search: {
    main: [wiki('A*_search_algorithm', 'A* search algorithm'), doi('10.1109/TSSC.1968.300136', 'Hart, Nilsson & Raphael (1968): the original A* paper')],
    parts: {
      map: wiki('State_space_search'),
      frontier: wiki('Priority_queue'),
      expand: wiki('Breadth-first_search'),
      heuristic: wiki('Admissible_heuristic'),
      path: wiki('Shortest_path_problem'),
    },
  },
  'expert-system': {
    main: [wiki('Expert_system'), wiki('Mycin', 'MYCIN, a famous medical expert system')],
    parts: {
      you: wiki('Knowledge_acquisition'),
      memory: wiki('Production_system_(computer_science)', 'Production systems and working memory'),
      engine: wiki('Inference_engine'),
      rules: wiki('Rule-based_system'),
      answer: wiki('Forward_chaining'),
    },
  },
  'decision-tree': {
    main: [tds('decision-trees-in-machine-learning-641b9c4e8052', 'Decision trees in machine learning'), wiki('Decision_tree_learning'), wiki('ID3_algorithm', 'ID3: an algorithm that grows decision trees')],
    parts: {
      fruit: wiki('Feature_(machine_learning)', 'Features in machine learning'),
      qColour: wiki('Information_gain_(decision_tree)', 'Choosing a split: information gain'),
      qRed: wiki('Entropy_(information_theory)', 'Entropy (information theory)'),
      qYellow: wiki('Decision_tree_pruning'),
      qGreen: wiki('Random_forest'),
      leaf: wiki('Statistical_classification'),
    },
  },
  'game-tree': {
    main: [wiki('Minimax'), wiki('Deep_Blue_(chess_computer)', 'Deep Blue (chess computer)')],
    parts: {
      board: wiki('Tic-tac-toe'),
      moves: wiki('Game_tree'),
      tree: wiki('Alpha–beta_pruning', 'Alpha–beta pruning'),
      score: wiki('Evaluation_function'),
      best: wiki('Solved_game'),
    },
  },
  'naive-bayes': {
    main: [wiki('Naive_Bayes_spam_filtering'), { title: 'Paul Graham (2002): A Plan for Spam', url: 'https://www.paulgraham.com/spam.html' }],
    parts: {
      email: wiki('Email_spam'),
      tokenizer: wiki('Bag-of-words_model'),
      counts: wiki('Naive_Bayes_classifier'),
      bayes: wiki('Bayes%27_theorem', 'Bayes’ theorem'),
      verdict: wiki('Email_filtering'),
    },
  },
  'neural-network-basics': {
    main: [
      web('https://www.3blue1brown.com/lessons/neural-networks', '3Blue1Brown: But what is a neural network?'),
      web('https://www.ibm.com/think/topics/neural-networks', 'IBM: What is a neural network?'),
      web('https://playground.tensorflow.org/', 'TensorFlow Playground: train a network in your browser'),
    ],
    parts: {
      inp: web('https://developers.google.com/machine-learning/crash-course/neural-networks/nodes-hidden-layers', 'Google ML Crash Course: Nodes and hidden layers'),
      h1: web('https://developers.google.com/machine-learning/crash-course/neural-networks/activation-functions', 'Google ML Crash Course: Activation functions'),
      h2: web('https://www.3blue1brown.com/lessons/neural-networks', '3Blue1Brown: why layers build up features'),
      out: web('https://developers.google.com/machine-learning/crash-course/neural-networks/multi-class', 'Google ML Crash Course: Multi-class outputs and softmax'),
    },
  },
  perceptron: {
    main: [
      tds('what-the-hell-is-perceptron-626217814f53', 'What the hell is a perceptron?'),
      wiki('Perceptron'),
      doi('10.1037/h0042519', 'Rosenblatt (1958): The perceptron'),
      bbg('ep168-ai-vs-machine-learning-vs-deep', 'ByteByteGo: AI vs Machine Learning vs Deep Learning'),
    ],
    parts: {
      inputs: wiki('Feature_(machine_learning)', 'Features in machine learning'),
      weights: wiki('Artificial_neuron'),
      sum: wiki('Linear_combination'),
      step: wiki('Heaviside_step_function'),
      output: wiki('Linear_separability'),
    },
  },
  backprop: {
    main: [
      med('karpathy.medium.com/yes-you-should-understand-backprop-e2f06eab496b', 'Andrej Karpathy: Yes you should understand backprop'),
      web('https://www.3blue1brown.com/lessons/backpropagation', '3Blue1Brown: What is backpropagation really doing?'),
      wiki('Backpropagation'),
      doi('10.1038/323533a0', 'Rumelhart, Hinton & Williams (1986): Learning representations by back-propagating errors'),
      bbg('why-ai-needs-gpus-and-tpus-the-hardware', 'ByteByteGo: Why AI Needs GPUs and TPUs'),
    ],
    parts: {
      x1: wiki('XOR_gate', 'The XOR problem'),
      x2: wiki('Perceptrons_(book)', 'Perceptrons (1969), the book that exposed XOR'),
      h1: wiki('Multilayer_perceptron'),
      h2: wiki('Sigmoid_function'),
      y: wiki('Chain_rule'),
      loss: wiki('Gradient_descent'),
    },
  },
  lstm: {
    main: [
      wiki('Long_short-term_memory'),
      { title: 'Understanding LSTM Networks (colah’s blog)', url: 'https://colah.github.io/posts/2015-08-Understanding-LSTMs/' },
    ],
    parts: {
      word: wiki('Recurrent_neural_network'),
      gates: wiki('Gated_recurrent_unit'),
      cell: wiki('Vanishing_gradient_problem'),
      hidden: wiki('Backpropagation_through_time'),
      output: wiki('Sentiment_analysis'),
    },
  },
  cnn: {
    main: [
      web('https://colah.github.io/posts/2014-07-Conv-Nets-Modular/', 'colah’s blog: Conv Nets, a modular perspective'),
      wiki('Convolutional_neural_network'),
      { title: 'CS231n: Convolutional Neural Networks (Stanford)', url: 'https://cs231n.github.io/convolutional-networks/' },
    ],
    parts: {
      image: wiki('MNIST_database', 'MNIST handwritten digits'),
      filter: wiki('Kernel_(image_processing)', 'Kernels in image processing'),
      map: wiki('Convolution'),
      pool: wiki('Pooling_layer'),
      classifier: wiki('Softmax_function'),
      label: wiki('AlexNet'),
    },
  },
  'q-learning': {
    main: [
      tds('simple-reinforcement-learning-q-learning-fcddc4b6fe56', 'Simple reinforcement learning: Q-learning'),
      wiki('Q-learning'),
      { title: 'Sutton & Barto: Reinforcement Learning, An Introduction (free book)', url: 'http://incompleteideas.net/book/the-book-2nd.html' },
    ],
    parts: {
      agent: wiki('Exploration–exploitation_dilemma', 'Exploration vs exploitation'),
      env: wiki('Markov_decision_process'),
      reward: wiki('Reinforcement_learning'),
      qtable: wiki('Bellman_equation'),
      policy: wiki('AlphaGo'),
    },
  },
  word2vec: {
    main: [web('https://jalammar.github.io/illustrated-word2vec/', 'The Illustrated Word2vec (Jay Alammar)'), wiki('Word2vec'), arxiv('1301.3781', 'Mikolov et al. (2013): Efficient Estimation of Word Representations')],
    parts: {
      words: wiki('Word_embedding'),
      table: wiki('Distributional_semantics'),
      math: wiki('Vector_space_model'),
      search: wiki('Cosine_similarity'),
      answer: wiki('GloVe', 'GloVe, a related embedding method'),
    },
  },
  gan: {
    main: [web('https://lilianweng.github.io/posts/2017-08-20-gan/', 'Lilian Weng: From GAN to WGAN'), wiki('Generative_adversarial_network'), arxiv('1406.2661', 'Goodfellow et al. (2014): Generative Adversarial Nets')],
    parts: {
      noise: wiki('Latent_space'),
      gen: wiki('Generative_model'),
      real: wiki('Training,_validation,_and_test_data_sets', 'Training data'),
      disc: wiki('Discriminative_model'),
      verdict: wiki('StyleGAN'),
    },
  },
  transformer: {
    main: [
      bbg('how-transformers-architecture-powers', 'ByteByteGo: How Transformers Architecture Powers Modern LLMs'),
      wiki('Transformer_(deep_learning_architecture)', 'Transformer (deep learning)'),
      arxiv('1706.03762', 'Vaswani et al. (2017): Attention Is All You Need'),
      { title: 'The Illustrated Transformer (Jay Alammar)', url: 'https://jalammar.github.io/illustrated-transformer/' },
    ],
    parts: {
      text: wiki('Prompt_engineering'),
      tokenizer: bbg('how-llms-see-the-world', 'ByteByteGo: How LLMs See the World (tokens)'),
      embed: bbg('how-the-math-used-in-19th-century', 'ByteByteGo: How LLMs encode word position'),
      attention: wiki('Attention_(machine_learning)', 'Attention (machine learning)'),
      ffn: wiki('Feedforward_neural_network'),
      predict: wiki('Softmax_function'),
      append: bbg('what-actually-happens-when-you-press', 'ByteByteGo: What happens when you press Send to ChatGPT'),
    },
  },
  rag: {
    main: [
      bbg('how-rag-enables-ai-for-your-data', 'ByteByteGo: How RAG Enables AI For Your Data'),
      wiki('Retrieval-augmented_generation'),
      arxiv('2005.11401', 'Lewis et al. (2020): Retrieval-Augmented Generation'),
    ],
    parts: {
      question: wiki('Question_answering'),
      embedder: wiki('Sentence_embedding'),
      vectordb: wiki('Vector_database'),
      retriever: bbg('how-llms-can-find-a-needle-in-a-haystack', 'ByteByteGo: How LLMs Find a Needle in a Haystack'),
      prompt: bbg('a-guide-to-context-engineering-for', 'ByteByteGo: A Guide to Context Engineering for LLMs'),
      llm: wiki('Large_language_model'),
      answer: wiki('Hallucination_(artificial_intelligence)', 'Hallucination in AI'),
    },
  },
  diffusion: {
    main: [web('https://jalammar.github.io/illustrated-stable-diffusion/', 'The Illustrated Stable Diffusion (Jay Alammar)'), web('https://lilianweng.github.io/posts/2021-07-11-diffusion-models/', 'Lilian Weng: What are diffusion models?'), wiki('Diffusion_model'), arxiv('2006.11239', 'Ho et al. (2020): Denoising Diffusion Probabilistic Models')],
    parts: {
      prompt: wiki('Text-to-image_model'),
      textenc: bbg('openai-clip-the-model-that-learnt', 'ByteByteGo: OpenAI CLIP, the text–image model'),
      noise: wiki('Gaussian_noise'),
      unet: wiki('U-Net'),
      scheduler: wiki('Latent_diffusion_model'),
      image: wiki('Stable_Diffusion'),
    },
  },
  rlhf: {
    main: [
      web('https://huggingface.co/blog/rlhf', 'Hugging Face: Illustrating RLHF'),
      web('https://huyenchip.com/2023/05/02/rlhf.html', 'Chip Huyen: RLHF explained'),
      bbg('how-llms-learn-from-the-internet', 'ByteByteGo: How LLMs Learn, The Training Process'),
      bbg('ep-44-how-does-chatgpt-work', 'ByteByteGo: How does ChatGPT work?'),
      wiki('Reinforcement_learning_from_human_feedback'),
      arxiv('2203.02155', 'Ouyang et al. (2022): InstructGPT'),
      arxiv('2305.18290', 'Rafailov et al. (2023): Direct Preference Optimization'),
    ],
    parts: {
      prompt: wiki('Prompt_engineering'),
      base: wiki('Generative_pre-trained_transformer'),
      answers: bbg('how-fine-tuning-transforms-generic', 'ByteByteGo: How Fine-Tuning Transforms Generic Models'),
      human: bbg('why-llms-agree-with-you-even-when', 'ByteByteGo: Why LLMs Agree With You (a side effect of feedback)'),
      reward: wiki('AI_alignment'),
      update: wiki('Proximal_policy_optimization'),
    },
  },
  agent: {
    main: [
      web('https://lilianweng.github.io/posts/2023-06-23-agent/', 'Lilian Weng: LLM-powered autonomous agents'),
      bbg('what-are-ai-agents', 'ByteByteGo: What are AI Agents?'),
      bbg('the-agent-loop-how-ai-goes-from-answering', 'ByteByteGo: The Agent Loop'),
      wiki('Intelligent_agent'),
      arxiv('2210.03629', 'Yao et al. (2022): ReAct, reasoning and acting'),
      arxiv('2302.04761', 'Schick et al. (2023): Toolformer'),
    ],
    parts: {
      user: wiki('Chatbot'),
      llm: wiki('Large_language_model'),
      tools: bbg('ep215-the-anatomy-of-an-ai-agent', 'ByteByteGo: The Anatomy of an AI Agent'),
      result: wiki('JSON', 'JSON: the format tool calls use'),
      answer: bbg('ep202-mcp-vs-rag-vs-ai-agents', 'ByteByteGo: MCP vs RAG vs AI Agents'),
    },
  },
  'mixture-of-experts': {
    main: [
      web('https://huggingface.co/blog/moe', 'Hugging Face: Mixture of Experts explained'),
      bbg('how-open-weight-models-changed-the', 'ByteByteGo: How Open-Weight Models Changed AI (MoE explained)'),
      wiki('Mixture_of_experts'),
      arxiv('1701.06538', 'Shazeer et al. (2017): Outrageously Large Neural Networks'),
      arxiv('2412.19437', 'DeepSeek-V3 Technical Report (2024)'),
      arxiv('2401.04088', 'Mixtral of Experts (2024)'),
    ],
    parts: {
      tokens: wiki('Large_language_model', 'Tokens in language models'),
      router: bbg('how-nvidias-new-nemotron-model-works', 'ByteByteGo: How Nvidia’s Nemotron routes tokens to experts'),
      e1: arxiv('2401.06066', 'DeepSeekMoE: expert specialisation'),
      e2: arxiv('2401.06066', 'DeepSeekMoE: expert specialisation'),
      e3: arxiv('2401.06066', 'DeepSeekMoE: expert specialisation'),
      e4: bbg('a-guide-to-ai-inference-engineering', 'ByteByteGo: AI Inference Engineering (expert parallelism)'),
      combine: wiki('Softmax_function', 'Softmax: the router’s weights'),
    },
  },
  reasoning: {
    main: [
      web('https://magazine.sebastianraschka.com/p/understanding-reasoning-llms', 'Sebastian Raschka: Understanding reasoning LLMs'),
      wiki('Reasoning_language_model'),
      arxiv('2201.11903', 'Wei et al. (2022): Chain-of-Thought Prompting'),
      arxiv('2501.12948', 'DeepSeek-R1 (2025)'),
    ],
    parts: {
      question: wiki('Cognitive_reflection_test'),
      fast: wiki('Thinking,_Fast_and_Slow', 'Thinking, Fast and Slow'),
      think: bbg('how-anthropics-claude-thinks', 'ByteByteGo: How Anthropic’s Claude Thinks'),
      check: bbg('why-do-llms-lie', 'ByteByteGo: Why Do LLMs Lie? (when reasoning isn’t faithful)'),
      answer: wiki('OpenAI_o1'),
    },
  },

  'linear-regression': {
    main: [
      tds('linear-regression-and-gradient-descent-for-absolute-beginners-eef9574eadb0', 'Linear regression and gradient descent for absolute beginners'),
      web('https://developers.google.com/machine-learning/crash-course/linear-regression', 'Google ML Crash Course: Linear regression'),
    ],
    parts: {
      data: web('https://scikit-learn.org/stable/modules/linear_model.html', 'scikit-learn: Linear models'),
      model: tds('implementing-linear-regression-with-gradient-descent-from-scratch-f6d088ec1219', 'Linear regression with gradient descent from scratch'),
      loss: web('https://developers.google.com/machine-learning/crash-course/linear-regression/loss', 'Google ML Crash Course: Loss'),
      gradient: tds('understanding-gradient-descent-35a7e3007098', 'Understanding gradient descent'),
      predict: tds('back-to-basics-part-dos-linear-regression-cost-function-and-gradient-descent-e3d7d05c56fd', 'Back to basics: cost function and gradient descent'),
    },
  },
  'logistic-regression': {
    main: [
      web('https://developers.google.com/machine-learning/crash-course/logistic-regression', 'Google ML Crash Course: Logistic regression'),
      tds('linear-regression-vs-logistic-regression-ols-maximum-likelihood-estimation-gradient-descent-bcfac2c7b8e4', 'Linear vs logistic regression'),
    ],
    parts: {
      student: web('https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression', 'scikit-learn: Logistic regression'),
      score: web('https://developers.google.com/machine-learning/crash-course/logistic-regression', 'Google ML Crash Course: Logistic regression'),
      sigmoid: web('https://developers.google.com/machine-learning/crash-course/logistic-regression/sigmoid-function', 'Google ML Crash Course: The sigmoid function'),
      threshold: web('https://developers.google.com/machine-learning/crash-course/classification/thresholding', 'Google ML Crash Course: Thresholds'),
      decision: tds('confusion-matrix-made-simple-accuracy-precision-recall-f1-score', 'Confusion matrix made simple'),
    },
  },
  'k-means': {
    main: [
      tds('k-means-clustering-explained-4528df86a120', 'K-Means clustering explained'),
      med('medium.com/@luo9137/k-means-clustering-clearly-explained-44746ccc3621', 'K-means clustering clearly explained'),
      web('https://scikit-learn.org/stable/modules/clustering.html#k-means', 'scikit-learn: K-means'),
    ],
    parts: {
      points: med('medium.com/@sean.j.moran/data-science-101-an-overview-of-k-means-64afa2717885', 'K-means explained'),
      init: web('https://scikit-learn.org/stable/modules/clustering.html#k-means', 'scikit-learn: K-means and k-means++ starts'),
      assign: med('medium.com/@luo9137/k-means-clustering-clearly-explained-44746ccc3621', 'K-means clustering clearly explained'),
      update: tds('k-means-clustering-explained-4528df86a120', 'K-Means clustering explained'),
      result: wiki('Elbow_method_(clustering)', 'The elbow method for choosing k'),
    },
  },
  pca: {
    main: [
      tds('principal-component-analysis-made-easy-a-step-by-step-tutorial-184f295e97fe', 'PCA made easy, step by step'),
      med('medium.com/swlh/intuition-behind-principal-component-analysis-you-ever-wanted-to-understand-af1b8c1ea801', 'The intuition behind PCA'),
      web('https://scikit-learn.org/stable/modules/decomposition.html#pca', 'scikit-learn: PCA'),
    ],
    parts: {
      data: tds('a-one-stop-shop-for-principal-component-analysis-5582fb7e0a9c', 'A one-stop shop for PCA'),
      center: tds('principal-component-analysis-made-easy-a-step-by-step-tutorial-184f295e97fe', 'PCA made easy, step by step'),
      cov: med('medium.com/intuition/mathematical-understanding-of-principal-component-analysis-6c761004c2f8', 'The maths of PCA'),
      eigen: web('https://www.3blue1brown.com/lessons/eigenvalues', '3Blue1Brown: Eigenvectors and eigenvalues'),
      project: web('https://scikit-learn.org/stable/modules/decomposition.html#pca', 'scikit-learn: PCA'),
    },
  },
  svm: {
    main: [
      med('medium.com/data-science/support-vector-machine-simply-explained-fee28eba5496', 'Support vector machine, simply explained'),
      tds('support-vector-classifier-explained-a-visual-guide-with-mini-2d-dataset-62e831e7b9e9', 'Support vector classifier: a visual guide'),
      web('https://scikit-learn.org/stable/modules/svm.html', 'scikit-learn: Support vector machines'),
    ],
    parts: {
      data: tds('support-vector-machine-svm-explained-58e59708cae3', 'SVM explained'),
      candidates: med('medium.com/analytics-vidhya/support-vector-machine-intuition-validate-with-maths-e10fb8cc7f57', 'Intuition behind SVMs'),
      margin: med('medium.com/data-science/support-vector-machine-simply-explained-fee28eba5496', 'SVM simply explained: the widest road'),
      support: tds('support-vector-classifier-explained-a-visual-guide-with-mini-2d-dataset-62e831e7b9e9', 'Support vectors, visually'),
      boundary: tds('a-mathematical-explanation-of-support-vector-machines-e433ffe04362', 'A mathematical explanation of SVMs'),
    },
  },
  'random-forest': {
    main: [
      med('williamkoehrsen.medium.com/random-forest-simple-explanation-377895a60d2d', 'Random forest simple explanation'),
      tds('random-forest-explained-a-visual-guide-with-code-examples-9f736a6e1b3c', 'Random forest: a visual guide'),
    ],
    parts: {
      data: web('https://scikit-learn.org/stable/modules/ensemble.html#random-forests', 'scikit-learn: Random forests'),
      bootstrap: tds('random-forest-in-simple-english-why-is-it-so-popular-3ba04d0374d', 'Random forest in simple English'),
      trees: tds('demystifying-the-random-forest-8a46f4fd416f', 'Demystifying the random forest'),
      vote: med('ujangriswanto08.medium.com/what-is-random-forest-a-beginners-guide-to-this-powerful-algorithm-313287ed89e0', 'A beginner’s guide to random forests'),
      result: web('https://xgboost.readthedocs.io/en/stable/tutorials/model.html', 'XGBoost: Introduction to boosted trees'),
    },
  },
  'model-evaluation': {
    main: [
      tds('confusion-matrix-made-simple-accuracy-precision-recall-f1-score', 'Confusion matrix made simple'),
      web('https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall', 'Google ML Crash Course: Accuracy, precision, recall'),
    ],
    parts: {
      scores: med('medium.com/@draj0718/understanding-confusion-matrix-precision-recall-and-f1-score-5b065f297f1b', 'Confusion matrix, precision-recall and F1'),
      threshold: web('https://developers.google.com/machine-learning/crash-course/classification/thresholding', 'Google ML Crash Course: Thresholds'),
      matrix: med('medium.com/analytics-vidhya/confusion-matrix-precision-recall-and-f1-score-d5f340e38cca', 'Confusion matrix, precision, recall and F1'),
      metrics: med('medium.com/analytics-vidhya/understanding-precision-recall-f1-score-and-confusion-matrix-b701659b9a21', 'What are precision, recall and F1?'),
      f1: web('https://developers.google.com/machine-learning/crash-course/classification/roc-and-auc', 'Google ML Crash Course: ROC and AUC'),
    },
  },
  attention: {
    main: [
      arxiv('1706.03762', 'Vaswani et al. (2017): Attention Is All You Need'),
      web('https://jalammar.github.io/illustrated-transformer/', 'The Illustrated Transformer (Jay Alammar)'),
      web('https://lilianweng.github.io/posts/2018-06-24-attention/', 'Lilian Weng: Attention? Attention!'),
    ],
    parts: {
      tokens: bbg('how-llms-see-the-world', 'ByteByteGo: How LLMs See the World'),
      qkv: web('https://jalammar.github.io/illustrated-transformer/', 'Jay Alammar: queries, keys and values, illustrated'),
      scores: web('https://lilianweng.github.io/posts/2018-06-24-attention/', 'Lilian Weng: Attention? Attention!'),
      softmax: bbg('how-transformers-architecture-powers', 'ByteByteGo: How Transformers Architecture Powers LLMs'),
      mix: web('https://jalammar.github.io/visualizing-neural-machine-translation-mechanics-of-seq2seq-models-with-attention/', 'Jay Alammar: Visualizing attention'),
      heads: web('https://nlp.seas.harvard.edu/annotated-transformer/', 'The Annotated Transformer (Harvard NLP)'),
    },
  },
  'vision-language-model': {
    main: [
      web('https://huggingface.co/blog/vlms', 'Hugging Face: Vision Language Models Explained'),
      bbg('multimodal-llms-basics-how-llms-process', 'ByteByteGo: Multimodal LLMs Basics'),
      arxiv('2304.08485', 'Liu et al. (2023): Visual Instruction Tuning (LLaVA)'),
    ],
    parts: {
      image: bbg('multimodal-llms-basics-how-llms-process', 'ByteByteGo: How LLMs process images'),
      patches: arxiv('2010.11929', 'Dosovitskiy et al. (2020): An Image is Worth 16x16 Words (ViT)'),
      embed: web('https://huggingface.co/docs/transformers/model_doc/vit', 'Hugging Face docs: Vision Transformer (patch embeddings)'),
      layers: bbg('openai-clip-the-model-that-learnt', 'ByteByteGo: OpenAI CLIP, the usual vision tower'),
      features: arxiv('2310.03744', 'Liu et al. (2023): Improved Baselines with Visual Instruction Tuning (LLaVA-1.5)'),
      projector: web('https://llava-vl.github.io/', 'LLaVA project page'),
      text: bbg('how-llms-see-the-world', 'ByteByteGo: How LLMs See the World'),
      llm: web('https://huggingface.co/blog/vlms', 'Hugging Face: Vision Language Models Explained'),
      answer: web('https://huggingface.co/blog/vlms', 'Hugging Face: what VLMs can do'),
    },
  },
  sampling: {
    main: [
      web('https://huggingface.co/blog/how-to-generate', 'Hugging Face: How to generate text (decoding methods)'),
      web('https://huyenchip.com/2024/01/16/sampling.html', 'Chip Huyen: Sampling for text generation'),
      arxiv('1904.09751', 'Holtzman et al. (2019): The Curious Case of Neural Text Degeneration (top-p)'),
    ],
    parts: {
      logits: web('https://huyenchip.com/2024/01/16/sampling.html', 'Chip Huyen: logits and sampling'),
      temp: web('https://huyenchip.com/2024/01/16/sampling.html', 'Chip Huyen: temperature'),
      softmax: bbg('how-transformers-architecture-powers', 'ByteByteGo: from vectors back to words'),
      topk: web('https://huggingface.co/blog/how-to-generate', 'Hugging Face: top-k sampling'),
      topp: arxiv('1904.09751', 'Nucleus (top-p) sampling paper'),
      sample: web('https://huggingface.co/blog/how-to-generate', 'Hugging Face: decoding methods'),
    },
  },
  'few-shot-prompting': {
    main: [
      web('https://www.promptingguide.ai/techniques/fewshot', 'Prompting Guide: Few-shot prompting'),
      web('https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/', 'Lilian Weng: Prompt engineering'),
      arxiv('2005.14165', 'Brown et al. (2020): Language Models are Few-Shot Learners (GPT-3)'),
    ],
    parts: {
      instruction: web('https://www.promptingguide.ai/techniques/zeroshot', 'Prompting Guide: Zero-shot prompting'),
      examples: web('https://www.promptingguide.ai/techniques/fewshot', 'Prompting Guide: Few-shot prompting'),
      prompt: web('https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/', 'Lilian Weng: Prompt engineering'),
      model: bbg('a-guide-to-context-engineering-for', 'ByteByteGo: A Guide to Context Engineering'),
      output: web('https://www.promptingguide.ai/techniques/cot', 'Prompting Guide: Chain-of-thought'),
    },
  },
  lora: {
    main: [
      web('https://huggingface.co/blog/peft', 'Hugging Face: Parameter-efficient fine-tuning (PEFT)'),
      web('https://magazine.sebastianraschka.com/p/practical-tips-for-finetuning-llms', 'Sebastian Raschka: Practical tips for LoRA'),
      arxiv('2106.09685', 'Hu et al. (2021): LoRA'),
    ],
    parts: {
      base: bbg('how-fine-tuning-transforms-generic', 'ByteByteGo: How Fine-Tuning Transforms Generic Models'),
      lora: arxiv('2106.09685', 'The LoRA paper'),
      data: bbg('how-to-customize-a-model-to-learn', 'ByteByteGo: How to Customize a Model'),
      train: web('https://huggingface.co/blog/peft', 'Hugging Face: PEFT'),
      merged: arxiv('2305.14314', 'Dettmers et al. (2023): QLoRA'),
    },
  },
  mcp: {
    main: [
      web('https://www.anthropic.com/news/model-context-protocol', 'Anthropic: Introducing the Model Context Protocol'),
      web('https://modelcontextprotocol.io/docs/getting-started/intro', 'Official MCP documentation'),
      bbg('ep202-mcp-vs-rag-vs-ai-agents', 'ByteByteGo: MCP vs RAG vs AI Agents'),
    ],
    parts: {
      user: bbg('what-are-ai-agents', 'ByteByteGo: What are AI Agents?'),
      host: web('https://modelcontextprotocol.io/docs/learn/architecture', 'MCP docs: Architecture (hosts, clients, servers)'),
      client: web('https://modelcontextprotocol.io/docs/learn/architecture', 'MCP docs: Clients and the JSON-RPC layer'),
      server: web('https://modelcontextprotocol.io/docs/learn/server-concepts', 'MCP docs: Server concepts (tools, resources, prompts)'),
      source: web('https://github.com/modelcontextprotocol/servers', 'GitHub: example MCP servers'),
    },
  },
  jepa: {
    main: [
      web('https://ai.meta.com/blog/yann-lecun-ai-model-i-jepa/', 'Meta AI: I-JEPA, the first model based on LeCun’s vision'),
      web('https://www.datacamp.com/blog/jepa-architecture-explained', 'DataCamp: JEPA architecture explained'),
      arxiv('2301.08243', 'Assran et al. (2023): I-JEPA'),
      web('https://openreview.net/forum?id=BZ5a1r-kVsf', 'LeCun (2022): A Path Towards Autonomous Machine Intelligence'),
    ],
    parts: {
      image: web('https://ai.meta.com/blog/yann-lecun-ai-model-i-jepa/', 'Meta AI: masking and predicting'),
      ctxenc: arxiv('2010.11929', 'Vision Transformer (ViT), the encoder JEPA uses'),
      tgtenc: arxiv('2301.08243', 'I-JEPA paper: the target encoder'),
      predictor: web('https://www.datacamp.com/blog/jepa-architecture-explained', 'DataCamp: how the predictor works'),
      loss: arxiv('2506.09985', 'V-JEPA 2 (2025): world models for robot planning'),
    },
  },
  'prompt-injection': {
    main: [
      web('https://simonwillison.net/2022/Sep/12/prompt-injection/', 'Simon Willison: Prompt injection attacks against GPT-3'),
      web('https://genai.owasp.org/llmrisk/llm01-prompt-injection/', 'OWASP Top 10 for LLMs: Prompt injection'),
    ],
    parts: {
      user: web('https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/', 'Simon Willison: The lethal trifecta for AI agents'),
      source: arxiv('2302.12173', 'Greshake et al. (2023): Indirect prompt injection'),
      agent: bbg('the-agent-loop-how-ai-goes-from-answering', 'ByteByteGo: The Agent Loop'),
      guard: web('https://genai.owasp.org/llmrisk/llm01-prompt-injection/', 'OWASP: Prevention and mitigation'),
      action: web('https://simonwillison.net/tags/prompt-injection/', 'Simon Willison: all posts on prompt injection'),
    },
  },
  tokenization: {
    main: [
      arxiv('1508.07909', 'Sennrich et al. (2016): Neural Machine Translation of Rare Words with Subword Units'),
      web('https://huggingface.co/learn/llm-course/chapter6/5', 'Hugging Face course: Byte-Pair Encoding tokenization'),
      wiki('Byte_pair_encoding', 'Byte-pair encoding'),
    ],
    parts: {
      text: wiki('Large_language_model', 'Large language model'),
      split: wiki('Character_(computing)', 'Characters in computing'),
      corpus: wiki('Text_corpus'),
      merges: wiki('Byte_pair_encoding', 'How BPE learns merges'),
      apply: web('https://github.com/openai/tiktoken', 'tiktoken: OpenAI’s BPE tokenizer'),
      ids: wiki('Word_embedding', 'From token IDs to embeddings'),
    },
  },
  'vector-search': {
    main: [
      arxiv('1908.10084', 'Reimers & Gurevych (2019): Sentence-BERT'),
      wiki('Vector_database'),
      wiki('Semantic_search'),
    ],
    parts: {
      query: wiki('Semantic_search'),
      embed: wiki('Sentence_embedding'),
      docs: wiki('Word_embedding'),
      index: arxiv('1603.09320', 'Malkov & Yashunin: HNSW approximate nearest-neighbour search'),
      score: wiki('Cosine_similarity'),
      results: wiki('Retrieval-augmented_generation', 'Retrieval-augmented generation'),
    },
  },
  'gradient-boosting': {
    main: [
      wiki('Gradient_boosting'),
      doi('10.1214/aos/1013203451', 'Friedman (2001): Greedy function approximation: a gradient boosting machine'),
      arxiv('1603.02754', 'Chen & Guestrin (2016): XGBoost'),
    ],
    parts: {
      data: wiki('Regression_analysis'),
      base: wiki('Arithmetic_mean'),
      residuals: wiki('Errors_and_residuals'),
      tree: wiki('Decision_stump'),
      add: wiki('Learning_rate'),
      model: wiki('Ensemble_learning'),
    },
  },
  overfitting: {
    main: [
      wiki('Overfitting'),
      web('https://developers.google.com/machine-learning/crash-course/overfitting', 'Google ML Crash Course: Overfitting'),
      doi('10.1080/00401706.1970.10488634', 'Hoerl & Kennard (1970): Ridge regression'),
    ],
    parts: {
      train: wiki('Training,_validation,_and_test_data_sets', 'Training, validation and test sets'),
      model: wiki('Polynomial_regression'),
      penalty: wiki('Ridge_regression'),
      fit: wiki('Least_squares'),
      validation: wiki('Cross-validation_(statistics)', 'Cross-validation'),
      verdict: wiki('Bias–variance_tradeoff', 'Bias–variance trade-off'),
    },
  },
  quantization: {
    main: [
      arxiv('2208.07339', 'Dettmers et al. (2022): LLM.int8()'),
      arxiv('2210.17323', 'Frantar et al. (2022): GPTQ'),
      web('https://huggingface.co/docs/transformers/main/en/quantization/overview', 'Hugging Face: Quantization overview'),
    ],
    parts: {
      weights: wiki('Half-precision_floating-point_format', 'Half-precision (16-bit) numbers'),
      range: wiki('Quantization_(signal_processing)', 'Quantization'),
      round: wiki('Rounding'),
      store: arxiv('2305.14314', 'Dettmers et al. (2023): QLoRA and 4-bit NormalFloat'),
      dequant: arxiv('2306.00978', 'Lin et al. (2023): AWQ'),
      result: wiki('Graphics_processing_unit', 'GPU memory'),
    },
  },
  'kv-cache': {
    main: [
      arxiv('1911.02150', 'Shazeer (2019): Fast Transformer Decoding (multi-query attention)'),
      arxiv('2305.13245', 'Ainslie et al. (2023): Grouped-query attention'),
      arxiv('2309.06180', 'Kwon et al. (2023): PagedAttention and vLLM'),
    ],
    parts: {
      prompt: wiki('Large_language_model', 'Large language model'),
      prefill: web('https://jalammar.github.io/illustrated-gpt2/', 'The Illustrated GPT-2 (Jay Alammar)'),
      attend: wiki('Attention_(machine_learning)', 'Attention'),
      cache: arxiv('2309.06180', 'PagedAttention: managing the KV cache'),
      decode: wiki('Autoregressive_model'),
      output: wiki('Transformer_(deep_learning_architecture)', 'Transformer architecture'),
    },
  },
}
