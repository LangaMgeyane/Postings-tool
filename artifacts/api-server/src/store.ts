import { randomUUID } from "crypto";

export interface User {
  id: string;
  displayName: string;
  name: string;
  tags: string[];
  createdAt: string;
  isAdmin: boolean;
}

export interface Post {
  id: string;
  title: string;
  body: string;
  excerpt: string;
  authorId: string;
  authorName: string;
  status: "draft" | "in-review" | "publish";
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  annotationCount: number;
  noteCount: number;
  readyForGallery: boolean;
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
  imageData: string | null;
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
  type: "post" | "annotationNode";
  postId: string | null;
  parentCardId: string | null;
  annotationId: string | null;
  title: string;
  authorName: string | null;
  status: string | null;
  category: string | null;
  tags: string[];
  noteText: string | null;
  annotationType: string | null;
  annotationPreview: string | null;
  x: number;
  y: number;
  groupId: string | null;
}

export interface PinConnection {
  from: string;
  to: string;
  system?: boolean;
}

export interface PinboardData {
  workspace: string;
  cards: PinCard[];
  connections: PinConnection[];
  updatedAt: string;
}

function isAdmin(displayName: string): boolean {
  return displayName.trim().endsWith("_");
}

const users: User[] = [
  {
    id: "U001",
    displayName: "alex",
    name: "Alex Mercer",
    tags: ["editor", "culture"],
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    isAdmin: false,
  },
  {
    id: "U002",
    displayName: "jamie",
    name: "Jamie Osei",
    tags: ["writer", "politics"],
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    isAdmin: false,
  },
  {
    id: "U003",
    displayName: "sasha",
    name: "Sasha Lindqvist",
    tags: ["writer", "art"],
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    isAdmin: false,
  },
  {
    id: "U004",
    displayName: "editor_",
    name: "Editor",
    tags: ["admin", "editor"],
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    isAdmin: true,
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
    status: "publish",
    category: "Culture",
    tags: ["media", "culture", "algorithm", "identity"],
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    annotationCount: 3,
    noteCount: 2,
    readyForGallery: true,
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
    readyForGallery: false,
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
    readyForGallery: false,
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
    readyForGallery: false,
  },
  {
    id: "P0005",
    title: "What We Mean When We Say Authentic",
    body: "<p>Authenticity is a marketing term now. It has been colonized so thoroughly by brands and influencers that it is almost unusable in serious discussion. And yet we need it. We have no replacement for the thing it used to name.</p><p>The authentic used to mean: made without calculation. Made because it had to be made. Made in the absence of an imagined audience.</p>",
    excerpt: "Authenticity is a marketing term now. It has been colonized so thoroughly by brands and influencers that it is almost unusable in serious discussion.",
    authorId: "U003",
    authorName: "Sasha Lindqvist",
    status: "publish",
    category: "Culture",
    tags: ["authenticity", "branding", "self", "media"],
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    annotationCount: 5,
    noteCount: 3,
    readyForGallery: true,
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
    readyForGallery: false,
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
    imageData: null,
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
    imageData: null,
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
    imageData: null,
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

// Seed pinboard — only in-review + publish posts, no sticky notes
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
          parentCardId: null,
          annotationId: null,
          title: "On the Death of the Monoculture",
          authorName: "Alex Mercer",
          status: "publish",
          category: "Culture",
          tags: ["media", "culture", "algorithm"],
          noteText: null,
          annotationType: null,
          annotationPreview: null,
          x: 120,
          y: 100,
          groupId: "G001",
        },
        {
          id: "PC0002",
          type: "post",
          postId: "P0005",
          parentCardId: null,
          annotationId: null,
          title: "What We Mean When We Say Authentic",
          authorName: "Sasha Lindqvist",
          status: "publish",
          category: "Culture",
          tags: ["authenticity", "branding", "media"],
          noteText: null,
          annotationType: null,
          annotationPreview: null,
          x: 420,
          y: 100,
          groupId: "G001",
        },
        {
          id: "PC0003",
          type: "post",
          postId: "P0002",
          parentCardId: null,
          annotationId: null,
          title: "The Aesthetics of Refusal",
          authorName: "Sasha Lindqvist",
          status: "in-review",
          category: "Art & Design",
          tags: ["aesthetics", "refusal", "politics"],
          noteText: null,
          annotationType: null,
          annotationPreview: null,
          x: 270,
          y: 320,
          groupId: null,
        },
        {
          id: "PC0004",
          type: "post",
          postId: "P0003",
          parentCardId: null,
          annotationId: null,
          title: "Night Shifts and Noise",
          authorName: "Jamie Osei",
          status: "in-review",
          category: "Reportage",
          tags: ["labor", "class", "language"],
          noteText: null,
          annotationType: null,
          annotationPreview: null,
          x: 600,
          y: 250,
          groupId: null,
        },
      ],
      connections: [
        { from: "PC0001", to: "PC0002", system: false },
      ],
      updatedAt: new Date().toISOString(),
    },
  ],
]);

// Whether the saved board state is user-modified (once saved, seed is not used)
const pinboardSaved: Set<string> = new Set();

function generateId(prefix: string): string {
  return `${prefix}${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export const store = {
  users,
  posts,
  annotations,
  comments,
  pinboards,

  findUser(displayName: string): User | undefined {
    const handle = displayName.replace(/^@/, "").toLowerCase();
    return users.find((u) => u.displayName.toLowerCase() === handle);
  },

  createUser(displayName: string): User {
    const handle = displayName.replace(/^@/, "");
    const admin = isAdmin(handle);
    const user: User = {
      id: generateId("U"),
      displayName: handle,
      name: admin
        ? handle.slice(0, -1).charAt(0).toUpperCase() + handle.slice(1, -1) + " (admin)"
        : handle.charAt(0).toUpperCase() + handle.slice(1),
      tags: admin ? ["admin"] : [],
      createdAt: new Date().toISOString(),
      isAdmin: admin,
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
    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
      readyForGallery: false,
    };
    posts.unshift(post);
    return post;
  },

  updatePost(id: string, data: Partial<Post>): Post | undefined {
    const idx = posts.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    posts[idx] = { ...posts[idx], ...data, updatedAt: new Date().toISOString() };
    return posts[idx];
  },

  submitPost(id: string): Post | undefined {
    const post = this.updatePost(id, { status: "in-review" });
    if (post) this.syncBoardPost(post, "WR");
    return post;
  },

  publishPost(id: string): Post | undefined {
    const post = this.updatePost(id, { status: "publish", readyForGallery: true });
    if (post) this.syncBoardPost(post, "WR");
    return post;
  },

  // Sync a post's pin card when its status changes
  syncBoardPost(post: Post, workspace: string): void {
    const board = this.getPinboard(workspace);
    const boardEligible = post.status === "in-review" || post.status === "publish";
    const existingIdx = board.cards.findIndex(
      (c) => c.type === "post" && c.postId === post.id
    );

    if (boardEligible && existingIdx === -1) {
      // Add new pin in a scattered position
      const offset = board.cards.filter((c) => c.type === "post").length;
      board.cards.push({
        id: generateId("PC"),
        type: "post",
        postId: post.id,
        parentCardId: null,
        annotationId: null,
        title: post.title,
        authorName: post.authorName,
        status: post.status,
        category: post.category,
        tags: post.tags,
        noteText: null,
        annotationType: null,
        annotationPreview: null,
        x: 120 + (offset % 4) * 240,
        y: 100 + Math.floor(offset / 4) * 180,
        groupId: null,
      });
    } else if (boardEligible && existingIdx !== -1) {
      // Update existing pin's status + title
      board.cards[existingIdx] = {
        ...board.cards[existingIdx],
        status: post.status,
        title: post.title,
      };
    } else if (!boardEligible && existingIdx !== -1) {
      // Remove pin (post reverted to draft)
      board.cards.splice(existingIdx, 1);
    }
    board.updatedAt = new Date().toISOString();
  },

  listAnnotations(postId: string): Annotation[] {
    return annotations.filter((a) => a.postId === postId);
  },

  listNotes(postId: string): Annotation[] {
    return annotations.filter((a) => a.postId === postId && a.type === "note");
  },

  createAnnotation(
    postId: string,
    data: Partial<Annotation>,
    authorId: string,
    authorName: string,
  ): Annotation {
    const ann: Annotation = {
      id: generateId("A"),
      postId,
      type: data.type || "note",
      text: data.text || null,
      noteType: data.noteType || null,
      strokes: data.strokes || [],
      texts: data.texts || [],
      imageData: data.imageData || null,
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
      // If post is on the board, sync annotation node
      if (post.status === "in-review" || post.status === "publish") {
        this.syncAnnotationNode(ann, postId, "WR");
      }
    }
    return ann;
  },

  // Add an annotation node to the board near its parent post pin
  syncAnnotationNode(ann: Annotation, postId: string, workspace: string): void {
    if (ann.type === "note") return; // notes don't become board nodes
    const board = this.getPinboard(workspace);
    const parentCard = board.cards.find((c) => c.type === "post" && c.postId === postId);
    if (!parentCard) return;

    // Count existing annotation nodes for this post to determine arc position
    const siblings = board.cards.filter(
      (c) => c.type === "annotationNode" && c.postId === postId
    );
    const idx = siblings.length;
    const angle = (idx * Math.PI) / 3 - Math.PI / 6; // arc spreading
    const radius = 160;
    const nx = (parentCard.x ?? 0) + 100 + Math.cos(angle) * radius;
    const ny = (parentCard.y ?? 0) + 50 + Math.sin(angle) * radius;

    const preview = ann.type === "text"
      ? (ann.texts?.[0]?.text || ann.text || "").slice(0, 40)
      : ann.strokes?.length
      ? `${ann.strokes.length} stroke${ann.strokes.length !== 1 ? "s" : ""}`
      : "drawing";

    const node: PinCard = {
      id: generateId("PN"),
      type: "annotationNode",
      postId,
      parentCardId: parentCard.id,
      annotationId: ann.id,
      title: `@${ann.authorName}`,
      authorName: ann.authorName,
      status: null,
      category: null,
      tags: [],
      noteText: preview,
      annotationType: ann.type,
      annotationPreview: preview,
      x: nx,
      y: ny,
      groupId: parentCard.groupId, // inherit parent's group
    };
    board.cards.push(node);

    // Add permanent system connection from node to parent
    board.connections.push({ from: node.id, to: parentCard.id, system: true });
    board.updatedAt = new Date().toISOString();
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
        // Remove board node for this annotation
        const board = this.getPinboard("WR");
        const nodeIdx = board.cards.findIndex(
          (c) => c.type === "annotationNode" && c.annotationId === annId
        );
        if (nodeIdx !== -1) {
          const node = board.cards[nodeIdx];
          board.cards.splice(nodeIdx, 1);
          board.connections = board.connections.filter(
            (cn) => cn.from !== node.id && cn.to !== node.id
          );
        }
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
    const board = pinboards.get(workspace)!;

    // If board hasn't been user-saved yet, sync all eligible posts
    if (!pinboardSaved.has(workspace)) {
      const eligible = posts.filter(
        (p) => p.status === "in-review" || p.status === "publish"
      );
      eligible.forEach((p) => {
        const exists = board.cards.some((c) => c.type === "post" && c.postId === p.id);
        if (!exists) this.syncBoardPost(p, workspace);
      });
    }

    return board;
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
    pinboardSaved.add(workspace);
    return updated;
  },
};
