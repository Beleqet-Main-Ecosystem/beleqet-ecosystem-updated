"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  usePortfolioQuery,
  useSavePortfolioMutation,
} from "../queries/portfolio-queries";
import {
  exportPortfolioJson,
  loadLocalPortfolioDraft,
  saveLocalPortfolioDraft,
} from "../services/portfolio-api";
import type {
  MasterProfileData,
  PortfolioPersistAction,
  PortfolioSectionId,
  TemplateId,
} from "../types";
import { createId } from "../utils/ids";
import {
  applyOrderIndices,
  reorderItems,
} from "../utils/reorder";
import {
  createEmptyPortfolio,
  switchTemplate,
  touchPortfolio,
} from "../utils/portfolio-state";
import type {
  CaseStudy,
  Certification,
  EducationEntry,
  ExperienceEntry,
  GalleryItem,
  PortfolioProject,
  SkillGroup,
  SocialLink,
} from "../types";

type BuilderState = {
  data: MasterProfileData;
  dirty: boolean;
  loaded: boolean;
};

/**
 * Central builder hook — local edit state with server hydration for auth users.
 */
export function usePortfolioBuilder(initialTemplate?: TemplateId) {
  const { user, ready } = useAuth();
  const portfolioQuery = usePortfolioQuery(Boolean(user && ready));
  const saveMutation = useSavePortfolioMutation();
  const [state, setState] = useState<BuilderState>({
    data: createEmptyPortfolio(),
    dirty: false,
    loaded: false,
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<PortfolioPersistAction | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (user) {
      if (portfolioQuery.isSuccess) {
        setState({
          data: portfolioQuery.data ?? createEmptyPortfolio(),
          dirty: false,
          loaded: true,
        });
      } else if (portfolioQuery.isError || portfolioQuery.isFetched) {
        setState({
          data: createEmptyPortfolio(),
          dirty: false,
          loaded: true,
        });
      }
    } else {
      const local = loadLocalPortfolioDraft();
      const base = local ?? createEmptyPortfolio();
      setState({
        data: initialTemplate
          ? switchTemplate(base, initialTemplate)
          : base,
        dirty: false,
        loaded: true,
      });
    }
  }, [
    ready,
    user,
    portfolioQuery.isSuccess,
    portfolioQuery.isError,
    portfolioQuery.isFetched,
    portfolioQuery.data,
    initialTemplate,
  ]);

  const updateData = useCallback(
    (updater: (current: MasterProfileData) => MasterProfileData) => {
      setState((prev) => ({
        data: touchPortfolio(updater(prev.data)),
        dirty: true,
        loaded: prev.loaded,
      }));
    },
    [],
  );

  const setTemplate = useCallback(
    (templateId: TemplateId) => {
      updateData((d) => switchTemplate(d, templateId));
    },
    [updateData],
  );

  const reorderSections = useCallback(
    (from: number, to: number) => {
      updateData((d) => ({
        ...d,
        sectionOrder: reorderItems(d.sectionOrder, from, to),
      }));
    },
    [updateData],
  );

  const reorderProjects = useCallback(
    (from: number, to: number) => {
      updateData((d) => ({
        ...d,
        projects: applyOrderIndices(
          reorderItems(sortProjects(d.projects), from, to),
        ),
      }));
    },
    [updateData],
  );

  const reorderSkills = useCallback(
    (from: number, to: number) => {
      updateData((d) => ({
        ...d,
        skills: applyOrderIndices(reorderItems(d.skills, from, to)),
      }));
    },
    [updateData],
  );

  const reorderCertifications = useCallback(
    (from: number, to: number) => {
      updateData((d) => ({
        ...d,
        certifications: applyOrderIndices(
          reorderItems(sortCerts(d.certifications), from, to),
        ),
      }));
    },
    [updateData],
  );

  const reorderGallery = useCallback(
    (from: number, to: number) => {
      updateData((d) => ({
        ...d,
        gallery: applyOrderIndices(
          reorderItems(sortGallery(d.gallery), from, to),
        ),
      }));
    },
    [updateData],
  );

  const toggleIndustry = useCallback(
    (tag: string) => {
      updateData((d) => ({
        ...d,
        industries: d.industries.includes(tag)
          ? d.industries.filter((t) => t !== tag)
          : [...d.industries, tag],
      }));
    },
    [updateData],
  );

  const persist = useCallback(
    async (action: PortfolioPersistAction) => {
      if (!user) {
        setPendingAction(action);
        setAuthModalOpen(true);
        return false;
      }
      const payload =
        action === "publish"
          ? { ...state.data, meta: { ...state.data.meta, published: true } }
          : state.data;

      if (action === "export") {
        const blob = exportPortfolioJson(payload);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "beleqet-portfolio.json";
        anchor.click();
        URL.revokeObjectURL(url);
      }

      const ok = await saveMutation.mutateAsync(payload);
      if (ok) {
        setState((prev) => ({
          data: payload,
          dirty: false,
          loaded: prev.loaded,
        }));
      }
      return ok;
    },
    [user, state.data, saveMutation],
  );

  const persistAfterAuth = useCallback(async () => {
    if (!user || !pendingAction) return;
    setAuthModalOpen(false);
    const action = pendingAction;
    setPendingAction(null);
    if (!user) {
      saveLocalPortfolioDraft(state.data);
    }
    await persist(action);
  }, [user, pendingAction, persist, state.data]);

  useEffect(() => {
    if (user && pendingAction && authModalOpen) {
      void persistAfterAuth();
    }
  }, [user, pendingAction, authModalOpen, persistAfterAuth]);

  const saveDraftLocally = useCallback(() => {
    saveLocalPortfolioDraft(state.data);
    setState((prev) => ({ ...prev, dirty: false }));
  }, [state.data]);

  return useMemo(
    () => ({
      data: state.data,
      dirty: state.dirty,
      loaded: state.loaded,
      isSaving: saveMutation.isPending,
      authModalOpen,
      setAuthModalOpen,
      updateData,
      setTemplate,
      reorderSections,
      reorderProjects,
      reorderSkills,
      reorderCertifications,
      reorderGallery,
      toggleIndustry,
      persist,
      saveDraftLocally,
      user,
      ready,
    }),
    [
      state,
      saveMutation.isPending,
      authModalOpen,
      updateData,
      setTemplate,
      reorderSections,
      reorderProjects,
      reorderSkills,
      reorderCertifications,
      reorderGallery,
      toggleIndustry,
      persist,
      saveDraftLocally,
      user,
      ready,
    ],
  );
}

function sortProjects(items: PortfolioProject[]) {
  return [...items].sort((a, b) => a.orderIndex - b.orderIndex);
}

function sortCerts(items: Certification[]) {
  return [...items].sort((a, b) => a.orderIndex - b.orderIndex);
}

function sortGallery(items: GalleryItem[]) {
  return [...items].sort((a, b) => a.orderIndex - b.orderIndex);
}

/** Factory helpers exported for builder forms. */
export function createDefaultProject(orderIndex: number): PortfolioProject {
  return {
    id: createId("project"),
    title: { en: "", am: "" },
    description: { en: "", am: "" },
    technologies: [],
    images: [],
    links: [],
    githubUrl: "",
    liveDemoUrl: "",
    tags: [],
    featured: false,
    orderIndex,
  };
}

export function createDefaultCaseStudy(orderIndex: number): CaseStudy {
  return {
    id: createId("case"),
    title: { en: "", am: "" },
    problem: { en: "", am: "" },
    solution: { en: "", am: "" },
    approach: { en: "", am: "" },
    results: { en: "", am: "" },
    screenshots: [],
    metrics: [],
    orderIndex,
  };
}

export function createDefaultCertification(orderIndex: number): Certification {
  return {
    id: createId("cert"),
    issuer: "",
    certificateName: { en: "", am: "" },
    credentialUrl: "",
    issueDate: "",
    expiryDate: "",
    orderIndex,
  };
}

export function createDefaultExperience(orderIndex: number): ExperienceEntry {
  return {
    id: createId("exp"),
    role: { en: "", am: "" },
    company: { en: "", am: "" },
    location: "",
    startDate: "",
    endDate: "",
    description: { en: "", am: "" },
    orderIndex,
  };
}

export function createDefaultEducation(orderIndex: number): EducationEntry {
  return {
    id: createId("edu"),
    institution: { en: "", am: "" },
    degree: { en: "", am: "" },
    field: { en: "", am: "" },
    startYear: "",
    endYear: "",
    description: { en: "", am: "" },
    orderIndex,
  };
}

export function createDefaultGalleryItem(orderIndex: number): GalleryItem {
  return {
    id: createId("gallery"),
    title: { en: "", am: "" },
    imageUrl: "",
    caption: { en: "", am: "" },
    orderIndex,
  };
}

export function createDefaultSocialLink(orderIndex: number): SocialLink {
  return {
    id: createId("social"),
    platform: "",
    url: "",
    orderIndex,
  };
}

export function createDefaultSkillGroup(orderIndex: number): SkillGroup {
  return {
    id: createId("skill_group"),
    category: "frontend",
    orderIndex,
    skills: [],
  };
}

export type ActiveSection = PortfolioSectionId;
