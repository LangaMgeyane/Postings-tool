import { randomUUID } from "crypto";

export interface User {
  id: string;
  slackHandle: string;
  name: string;
  tags: string[];
  createdAt: string;
}

export interface Post {
  id: string;
  title: string;
  body: string;
  excerpt: string;
  authorId: string;
  authorName: string;
  status: "draft" | "in-review" | "published";
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  annotationCount: number;
  noteCount: number;
}

export interface Stroke {
  points: { x: number; y: number }[];
}

export interface TextAnnotation {
  x: number;
  y: number;
  text: string;
}

export interface Annotation {
  id: string;
  postId: string;
  type: "drawing" | "text" | "note";
  text: string | null;
  noteType: string | null;
  strokes: Stroke[];
  texts: TextAnnotation[];
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface PinCard {
  id: string;
  type: "post" | "stickyNote";
  postId: string | null;
  title: string;
  authorName: string | null;
  status: string | null;
  category: string | null;
  tags: string[];
  noteText: string | null;
  x: number;
  y: number;
  groupId: string | null;
}

export interface PinConnection {
  from: string;
  to: string;
}

export interface PinboardData {
  workspace: string;
  cards: PinCard[];
  connections: PinConnection[];
  updatedAt: string;
}

const users: User[] = [
  {
    id: "U001",
    slackHandle: "alex",
    name: "Alex Mercer",
    tags: ["editor", "culture"],
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: "U002",
    slackHandle: "jamie",
    name: "Jamie Osei",
    tags: ["writer", "politics"],
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: "U003",
    slackHandle: "sasha",
    name: "Sasha Lindqvist",
    tags: ["writer", "art"],
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
];

const posts: Post[] = [
  {
    id: "P0001",
    title: "On the Death of the Monoculture",
    body: "<p>There is no longer a center. The last monoculture died sometime between the final episode of a show everyone watched and the first algorithm-curated feed that replaced the water cooler conversation entirely.</p><p>What we have now is archipelagos — islands of shared reference, separated by vast stretches of incomprehension. Your coworker genuinely does not know the show you're referencing. Your parent has never encountered the meme that shaped your entire worldview in 2019.</p><p>This is not lamented here. It is observed. The question is what replaces the shared grammar — what do we build in the absence of a common text?</p><p>Scheme exists in the gap. We are not trying to resurrect a monoculture. We are trying to build something better: a multiplicity of cultures in conversation, each legible to the others even when they do not share the same references.</p>",
    excerpt: "There is no longer a center. The last monoculture died somewhere between the final episode everyone watched and the first algorithm-curated feed.",
    authorId: "U001",
    authorName: "Alex Mercer",
    status: "published",
    category: "Culture",
    tags: ["media", "culture", "algorithm", "identity"],
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    annotationCount: 3,
    noteCount: 2,
  },
  {
    id: "P0002",
    title: "The Aesthetics of Refusal",
    body: "<p>Refusal is an aesthetic act. To say no — to a platform, to a format, to an audience expectation — is to make something. The shape of a refusal is a kind of design.</p><p>We are surrounded by the aesthetics of compliance: content optimized for engagement, arguments structured for shareability, art made to be thumbnails. The refusal aesthetic is rarer and harder. It requires believing that the thing you are making is worth the cost of making it badly, slowly, or not at all.</p><p>This is also a political position, though it often masquerades as a purely formal one.</p>",
    excerpt: "Refusal is an aesthetic act. To say no — to a platform, a format, an audience expectation — is to make something. The shape of a refusal is design.",
    authorId: "U003",
    authorName: "Sasha Lindqvist",
    status: "in-review",
    category: "Art & Design",
    tags: ["aesthetics", "refusal", "politics", "form"],
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    annotationCount: 1,
    noteCount: 4,
  },
  {
    id: "P0003",
    title: "Night Shifts and Noise: A Report from the Floor",
    body: "<p>The warehouse floor at 3am is its own civilization. Shift workers have developed a language of gesture and proximity that bypasses the ear protection entirely — a tap on the shoulder means one thing, a raised hand another. The forklift operator who's been here eleven years communicates in a dialect of beeps and reverses that the new hires spend months learning to read.</p><p>I am not the first journalist to notice this. I am trying to notice it differently.</p>",
    excerpt: "The warehouse floor at 3am is its own civilization. Shift workers have developed a language of gesture and proximity that bypasses the ear protection entirely.",
    authorId: "U002",
    authorName: "Jamie Osei",
    status: "in-review",
    category: "Reportage",
    tags: ["labor", "class", "language", "documentation"],
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    annotationCount: 2,
    noteCount: 1,
  },
  {
    id: "P0004",
    title: "Cities That Remember Themselves",
    body: "<p>Some cities wear their history in layers that anyone can read. Others bury it. The difference is not age — London and Lagos are both ancient — but something more like disposition, or policy.</p><p>The renovated building that erases its history is making a statement. So is the derelict one. We read both as texts, whether we intend to or not.</p>",
    excerpt: "Some cities wear their history in layers that anyone can read. Others bury it. The difference is not age but something more like disposition, or policy.",
    authorId: "U001",
    authorName: "Alex Mercer",
    status: "draft",
    category: "Urban",
    tags: ["cities", "memory", "architecture", "history"],
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    annotationCount: 0,
    noteCount: 0,
  },
  {
    id: "P0005",
    title: "What We Mean When We Say Authentic",
    body: "<p>Authenticity is a marketing term now. It has been colonized so thoroughly by brands and influencers that it is almost unusable in serious discussion. And yet we need it. We have no replacement for the thing it used to name.</p><p>The authentic used to mean: made without calculation. Made because it had to be made. Made in the absence of an imagined audience.</p>",
    excerpt: "Authenticity is a marketing term now. It has been colonized so thoroughly by brands and influencers that it is almost unusable in serious discussion.",
    authorId: "U003",
    authorName: "Sasha Lindqvist",
    status: "published",
    category: "Culture",
    tags: ["authenticity", "branding", "self", "media"],
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    annotationCount: 5,
    noteCount: 3,
  },
  {
    id: "P0006",
    title: "The Problem With Solidarity Tourism",
    body: "<p>Solidarity is not a feeling. It is not the emotion you have when you attend a rally, or share a post, or wear a shirt. Those things can accompany solidarity, but they are not it. Solidarity is a practice — a set of sustained, costly commitments made to people outside your immediate circle.</p><p>We have confused the aesthetics of solidarity with solidarity itself. This is not a new confusion.</p>",
    excerpt: "Solidarity is not a feeling. It is not the emotion you have when you attend a rally or share a post. Solidarity is a practice — sustained, costly commitments.",
    authorId: "U002",
    authorName: "Jamie Osei",
    status: "draft",
    category: "Politics",
    tags: ["solidarity", "politics", "activism", "class"],
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    annotationCount: 0,
    noteCount: 0,
  },
];

const annotations: Annotation[] = [
  {
    id: "A0001",
    postId: "P0001",
    type: "note",
    text: "This paragraph needs a citation — the 'death of monoculture' thesis has been made by others, we should acknowledge the discourse.",
    noteType: "factual",
    strokes: [],
    texts: [],
    authorId: "U001",
    authorName: "Alex Mercer",
    createdAt: new Date(Date.now() - 11 * 86400000).toISOString(),
  },
  {
    id: "A0002",
    postId: "P0001",
    type: "note",
    text: "Love the 'archipelagos' metaphor — consider building it out further in the conclusion.",
    noteType: "style",
    strokes: [],
    texts: [],
    authorId: "U001",
    authorName: "Alex Mercer",
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: "A0003",
    postId: "P0005",
    type: "note",
    text: "Strong opening. The transition to the third paragraph feels abrupt — consider a bridge sentence.",
    noteType: "editorial",
    strokes: [],
    texts: [],
    authorId: "U002",
    authorName: "Jamie Osei",
    createdAt: new Date(Date.now() - 17 * 86400000).toISOString(),
  },
];

const comments: Comment[] = [
  {
    id: "C0001",
    postId: "P0001",
    text: "This is exactly what Scheme should be publishing. The archipelago framing is genuinely useful.",
    authorId: "U003",
    authorName: "Sasha Lindqvist",
    createdAt: new Date(Date.now() - 11 * 86400000).toISOString(),
  },
  {
    id: "C0002",
    postId: "P0001",
    text: "I'd push back a little on the framing — are these really 'islands of incomprehension' or is it more that we have many different competencies now?",
    authorId: "U002",
    authorName: "Jamie Osei",
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: "C0003",
    postId: "P0005",
    text: "Really sharp. The point about the imagined audience is doing a lot of work here.",
    authorId: "U001",
    authorName: "Alex Mercer",
    createdAt: new Date(Date.now() - 17 * 86400000).toISOString(),
  },
];

const pinboards: Map<string, PinboardData> = new Map([
  [
    "WR",
    {
      workspace: "WR",
      cards: [
        {
          id: "PC0001",
          type: "post",
          postId: "P0001",
          title: "On the Death of the Monoculture",
          authorName: "Alex Mercer",
          status: "published",
          category: "Culture",
          tags: ["media", "culture", "algorithm"],
          noteText: null,
          x: 120,
          y: 100,
          groupId: "G001",
        },
        {
          id: "PC0002",
          type: "post",
          postId: "P0005",
          title: "What We Mean When We Say Authentic",
          authorName: "Sasha Lindqvist",
          status: "published",
          category: "Culture",
          tags: ["authenticity", "branding", "media"],
          noteText: null,
          x: 420,
          y: 100,
          groupId: "G001",
        },
        {
          id: "PC0003",
          type: "post",
          postId: "P0002",
          title: "The Aesthetics of Refusal",
          authorName: "Sasha Lindqvist",
          status: "in-review",
          category: "Art & Design",
          tags: ["aesthetics", "refusal", "politics"],
          noteText: null,
          x: 270,
          y: 300,
          groupId: null,
        },
        {
          id: "PC0004",
          type: "post",
          postId: "P0003",
          title: "Night Shifts and Noise",
          authorName: "Jamie Osei",
          status: "in-review",
          category: "Reportage",
          tags: ["labor", "class", "language"],
          noteText: null,
          x: 600,
          y: 250,
          groupId: null,
        },
        {
          id: "PC0005",
          type: "stickyNote",
          postId: null,
          title: "Sticky",
          authorName: null,
          status: null,
          category: null,
          tags: [],
          noteText: "Theme cluster: authenticity + refusal + monoculture → possible issue?",
          x: 270,
          y: 480,
          groupId: null,
        },
      ],
      connections: [
        { from: "PC0001", to: "PC0002" },
        { from: "PC0002", to: "PC0003" },
      ],
      updatedAt: new Date().toISOString(),
    },
  ],
]);

function generateId(prefix: string): string {
  return `${prefix}${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export const store = {
  users,
  posts,
  annotations,
  comments,
  pinboards,

  findUser(slackHandle: string): User | undefined {
    return users.find(
      (u) => u.slackHandle.toLowerCase() === slackHandle.toLowerCase().replace(/^@/, ""),
    );
  },

  createUser(slackHandle: string): User {
    const handle = slackHandle.replace(/^@/, "");
    const user: User = {
      id: generateId("U"),
      slackHandle: handle,
      name: handle.charAt(0).toUpperCase() + handle.slice(1),
      tags: [],
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    return user;
  },

  findPost(id: string): Post | undefined {
    return posts.find((p) => p.id === id);
  },

  listPosts(authorId?: string, status?: string): Post[] {
    let result = [...posts];
    if (authorId) result = result.filter((p) => p.authorId === authorId);
    if (status) result = result.filter((p) => p.status === status);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  createPost(data: Partial<Post>, authorId: string, authorName: string): Post {
    const post: Post = {
      id: generateId("P"),
      title: data.title || "Untitled",
      body: data.body || "",
      excerpt: data.excerpt || "",
      authorId,
      authorName,
      status: "draft",
      category: data.category || "",
      tags: data.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      annotationCount: 0,
      noteCount: 0,
    };
    posts.unshift(post);
    return post;
  },

  updatePost(id: string, data: Partial<Post>): Post | undefined {
    const idx = posts.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    posts[idx] = {
      ...posts[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return posts[idx];
  },

  submitPost(id: string): Post | undefined {
    return this.updatePost(id, { status: "in-review" });
  },

  listAnnotations(postId: string): Annotation[] {
    return annotations.filter((a) => a.postId === postId);
  },

  listNotes(postId: string): Annotation[] {
    return annotations.filter((a) => a.postId === postId && a.type === "note");
  },

  createAnnotation(postId: string, data: Partial<Annotation>, authorId: string, authorName: string): Annotation {
    const ann: Annotation = {
      id: generateId("A"),
      postId,
      type: data.type || "note",
      text: data.text || null,
      noteType: data.noteType || null,
      strokes: data.strokes || [],
      texts: data.texts || [],
      authorId,
      authorName,
      createdAt: new Date().toISOString(),
    };
    annotations.push(ann);
    const post = this.findPost(postId);
    if (post) {
      if (ann.type === "note") {
        post.noteCount = (post.noteCount || 0) + 1;
      } else {
        post.annotationCount = (post.annotationCount || 0) + 1;
      }
    }
    return ann;
  },

  deleteAnnotation(postId: string, annId: string): boolean {
    const idx = annotations.findIndex((a) => a.id === annId && a.postId === postId);
    if (idx === -1) return false;
    const [ann] = annotations.splice(idx, 1);
    const post = this.findPost(postId);
    if (post) {
      if (ann.type === "note") {
        post.noteCount = Math.max(0, (post.noteCount || 0) - 1);
      } else {
        post.annotationCount = Math.max(0, (post.annotationCount || 0) - 1);
      }
    }
    return true;
  },

  listComments(postId: string): Comment[] {
    return comments.filter((c) => c.postId === postId);
  },

  createComment(postId: string, text: string, authorId: string, authorName: string): Comment {
    const comment: Comment = {
      id: generateId("C"),
      postId,
      text,
      authorId,
      authorName,
      createdAt: new Date().toISOString(),
    };
    comments.push(comment);
    return comment;
  },

  deleteComment(postId: string, commentId: string): boolean {
    const idx = comments.findIndex((c) => c.id === commentId && c.postId === postId);
    if (idx === -1) return false;
    comments.splice(idx, 1);
    return true;
  },

  getPinboard(workspace: string): PinboardData {
    if (!pinboards.has(workspace)) {
      pinboards.set(workspace, {
        workspace,
        cards: [],
        connections: [],
        updatedAt: new Date().toISOString(),
      });
    }
    return pinboards.get(workspace)!;
  },

  savePinboard(workspace: string, data: Partial<PinboardData>): PinboardData {
    const existing = this.getPinboard(workspace);
    const updated: PinboardData = {
      ...existing,
      cards: data.cards ?? existing.cards,
      connections: data.connections ?? existing.connections,
      updatedAt: new Date().toISOString(),
    };
    pinboards.set(workspace, updated);
    return updated;
  },
};
