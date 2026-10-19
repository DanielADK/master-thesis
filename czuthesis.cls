%% czuthesis.cls
%% =============================================================================
%% LaTeX document class for theses at PEF ČZU
%% (Provozně ekonomická fakulta, Česká zemědělská univerzita v Praze)
%%
%% Requires XeLaTeX or LuaLaTeX (for fontspec / Times New Roman).
%%
%% Usage:
%%   \documentclass[DP]{czuthesis}              % master's thesis (default)
%%   \documentclass[BP]{czuthesis}              % bachelor's thesis
%%   \documentclass[DP,latexfonts]{czuthesis}   % Latin Modern fonts
%%   \documentclass[DP,twoside]{czuthesis}      % double-sided print
%%   \documentclass[DP,code]{czuthesis}         % syntax-highlighted listings (minted)
%% =============================================================================

\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{czuthesis}[2026/04/01 CZU PEF thesis class v1.1]

%% ===================================================================
%% OPTIONS
%% ===================================================================

\RequirePackage{ifthen}

\newcommand{\CZU@levelCZ}{Diplomov\'{a} pr\'{a}ce}
\newcommand{\CZU@levelEN}{Master thesis}
\newcommand{\CZU@levelCZgen}{diplomov\'{e} pr\'{a}ce}
\newcommand{\CZU@levelCZacc}{diplomovou pr\'{a}ci}

\DeclareOption{BP}{%
  \renewcommand{\CZU@levelCZ}{Bakal\'{a}\v{r}sk\'{a} pr\'{a}ce}%
  \renewcommand{\CZU@levelEN}{Bachelor thesis}%
  \renewcommand{\CZU@levelCZgen}{bakal\'{a}\v{r}sk\'{e} pr\'{a}ce}%
  \renewcommand{\CZU@levelCZacc}{bakal\'{a}\v{r}skou pr\'{a}ci}%
}
\DeclareOption{DP}{}

\newif\ifCZU@latexfonts
\CZU@latexfontsfalse
\DeclareOption{latexfonts}{\CZU@latexfontstrue}

\newif\ifCZU@code
\CZU@codefalse
\DeclareOption{code}{\CZU@codetrue}

\DeclareOption*{\PassOptionsToClass{\CurrentOption}{report}}
\ProcessOptions\relax

%% ===================================================================
%% BASE CLASS + VISUAL IDENTITY
%% ===================================================================

\LoadClass[a4paper, 12pt]{report}
\RequirePackage{czu}

%% ===================================================================
%% PAGE GEOMETRY: top=30mm, bottom=25mm, inner=35mm, outer=20mm
%% ===================================================================

\RequirePackage[
  a4paper, top=30mm, bottom=25mm, inner=35mm, outer=20mm,
  headheight=15pt,
]{geometry}

%% ===================================================================
%% FONTS
%% ===================================================================

\RequirePackage{fontspec}
%\ifCZU@latexfonts\else
%  \setmainfont{Times New Roman}
%  \setsansfont{Arial}
%\fi

%% ===================================================================
%% TYPOGRAPHY
%% ===================================================================

\RequirePackage{microtype}
\RequirePackage{setspace}
\onehalfspacing
\setlength{\parindent}{1.27cm}  % 720 twips = ČZU Word template exact value
\raggedbottom
\clubpenalty=10000
\widowpenalty=10000

%% ===================================================================
%% FLOAT BARRIERS: keep figures/tables within their section
%% ===================================================================

\RequirePackage[section]{placeins}

%% ===================================================================
%% CONTINUOUS NUMBERING: Obrázek 1, Tabulka 1, ... (not per chapter)
%% ===================================================================

\counterwithout{figure}{chapter}
\counterwithout{table}{chapter}
\counterwithout{equation}{chapter}

%% ===================================================================
%% GRAF FLOAT TYPE: \begin{czugraf}[H] \caption{...} \end{czugraf}
%% ===================================================================

\RequirePackage{float}
\RequirePackage{newfloat}
\DeclareFloatingEnvironment[fileext=logrf, name=Graf]{czugraf}

%% ===================================================================
%% TOC + HEADING STYLES
%% ===================================================================

\setcounter{tocdepth}{2}
\setcounter{secnumdepth}{3}

\RequirePackage{titlesec}

\titleformat{\chapter}
  {\normalfont\bfseries\fontsize{16pt}{24pt}\selectfont}
  {\thechapter}{1em}{}
\titlespacing*{\chapter}{0pt}{12pt}{6pt}

\titleformat{\section}
  {\normalfont\bfseries\fontsize{14pt}{16.8pt}\selectfont}
  {\thesection}{1em}{}
\titlespacing*{\section}{0pt}{12pt}{14pt}

\titleformat{\subsection}
  {\normalfont\bfseries\fontsize{12pt}{14.4pt}\selectfont}
  {\thesubsection}{1em}{}
\titlespacing*{\subsection}{0pt}{12pt}{12pt}

%% ===================================================================
%% PAGE STYLES
%% ===================================================================

\RequirePackage{fancyhdr}

\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}
\fancyfoot[C]{\thepage}

\fancypagestyle{plain}{%
  \fancyhf{}%
  \renewcommand{\headrulewidth}{0pt}%
  \fancyfoot[C]{\thepage}%
}

%% ===================================================================
%% UTILITY PACKAGES
%% ===================================================================

\RequirePackage{xurl}
\RequirePackage{pdfpages}

%% ===================================================================
%% HYPERREF: black clickable links, PDF bookmarks + metadata
%% ===================================================================
%% Hyperref must be loaded late (after most packages that may patch it).
%% pdftitle/pdfauthor are set in \AtBeginDocument from PDF-safe copies.

\RequirePackage[
  colorlinks=true,
  linkcolor=black,
  urlcolor=black,
  citecolor=black,
  bookmarks=true,
  bookmarksnumbered=true,
  unicode=true,
  hidelinks=false,
]{hyperref}
% pdftitle/pdfauthor must be set after \CZUtitle/\CZUauthor are called
\AtBeginDocument{%
  \hypersetup{pdftitle={\CZU@titlePDF}, pdfauthor={\CZU@authorPDF}}%
}

%% ===================================================================
%% METADATA
%% ===================================================================

\newcommand{\CZU@title}{N\'{a}zev pr\'{a}ce}
\newcommand{\CZU@titleEN}{Thesis title}
\newcommand{\CZU@author}{Jm\'{e}no P\v{r}\'{i}jmen\'{i}}
\newcommand{\CZU@department}{Katedra}
\newcommand{\CZU@year}{\the\year}

% PDF-safe copies (~ replaced with normal space for PDF metadata)
\newcommand{\CZU@titlePDF}{N\'{a}zev pr\'{a}ce}
\newcommand{\CZU@authorPDF}{Jm\'{e}no P\v{r}\'{i}jmen\'{i}}

\newcommand{\CZUtitle}[2]{%
  \renewcommand{\CZU@title}{#1}%
  \renewcommand{\CZU@titleEN}{#2}%
  \begingroup\let~\space
    \protected@xdef\CZU@titlePDF{#1}%
  \endgroup
}
\newcommand{\CZUauthor}[1]{%
  \renewcommand{\CZU@author}{#1}%
  \begingroup\let~\space
    \protected@xdef\CZU@authorPDF{#1}%
  \endgroup
}
\newcommand{\CZUdepartment}[1]{\renewcommand{\CZU@department}{#1}}
\newcommand{\CZUyear}[1]{\renewcommand{\CZU@year}{#1}}

%% ===================================================================
%% TITLE PAGE
%% ===================================================================

\newcommand{\CZUtitlepage}{%
  \thispagestyle{empty}%
  \begingroup
  \centering
  \bfseries\fontsize{18pt}{22pt}\selectfont
  %
  \vspace*{0.5cm}
  %
  \CZUname\par\vspace{0.5em}%
  \PEFname\par\vspace{0.5em}%
  \CZU@department\par
  %
  \vspace{14pt}
  %
  {\normalfont\czusymbol}\par
  %
  \vspace{15pt}
  %
  {\fontsize{25pt}{30pt}\selectfont \CZU@levelCZ\par}%
  \vspace{0.5em}%
  \CZU@title\par
  %
  \vspace{32pt}
  %
  \CZU@author\par
  %
  \vfill
  %
  {\fontsize{17pt}{20pt}\selectfont
    \textcopyright~\CZU@year{} \v{C}ZU v~Praze\par}
  \endgroup
  \clearpage
}

%% ===================================================================
%% ASSIGNMENT
%% ===================================================================

\newcommand{\CZUassignment}[1]{\includepdf[pages=-]{#1}}

%% ===================================================================
%% DECLARATION: text at bottom of page
%% ===================================================================

\newcommand{\CZUdeclaration}[1][male]{%
  \clearpage\thispagestyle{empty}%
  \mbox{}\vfill
  {\bfseries \v{C}estn\'{e} prohl\'{a}\v{s}en\'{i}\par}
  \vspace{15pt}
  Prohla\v{s}uji, \v{z}e svou \CZU@levelCZacc{}
  \quotedblbase\CZU@title\textquotedblleft{}
  jsem vypracoval\ifthenelse{\equal{#1}{female}}{a}{} samostatn\v{e}
  pod veden\'{i}m vedouc\'{i}ho \CZU@levelCZgen{}
  a~s~pou\v{z}it\'{i}m odborn\'{e} literatury a~dal\v{s}\'{i}ch
  informa\v{c}n\'{i}ch zdroj\r{u}, kter\'{e} jsou citov\'{a}ny
  v~pr\'{a}ci a~uvedeny v~seznamu pou\v{z}it\'{y}ch zdroj\r{u}
  na konci pr\'{a}ce. Jako autor\ifthenelse{\equal{#1}{female}}{ka}{}
  uveden\'{e} \CZU@levelCZgen{} d\'{a}le prohla\v{s}uji, \v{z}e jsem
  v~souvislosti s~jej\'{i}m vytvo\v{r}en\'{i}m
  neporu\v{s}il\ifthenelse{\equal{#1}{female}}{a}{} autorsk\'{a}
  pr\'{a}va t\v{r}et\'{i}ch osob.
  \vspace{1.5cm}
  \\\noindent V~Praze dne \hspace{3cm} \hfill \makebox[5cm]{\dotfill}
  \clearpage
}

%% ===================================================================
%% DECLARATION WITH AI CLAUSE
%% ===================================================================

\newcommand{\CZUdeclarationAI}[1][male]{%
  \clearpage\thispagestyle{empty}%
  \mbox{}\vfill
  {\noindent\bfseries \v{C}estn\'{e} prohl\'{a}\v{s}en\'{i}\par}
  \vspace{15pt}
  \noindent
  Prohla\v{s}uji, \v{z}e svou \CZU@levelCZacc{}
  \quotedblbase\CZU@title\textquotedblleft{}
  jsem vypracoval\ifthenelse{\equal{#1}{female}}{a}{} samostatn\v{e}
  pod veden\'{i}m vedouc\'{i}ho \CZU@levelCZgen{}
  a~s~pou\v{z}it\'{i}m odborn\'{e} literatury a~dal\v{s}\'{i}ch
  informa\v{c}n\'{i}ch zdroj\r{u}, kter\'{e} jsou citov\'{a}ny
  v~pr\'{a}ci a~uvedeny v~seznamu pou\v{z}it\'{y}ch zdroj\r{u}
  na konci pr\'{a}ce. Jako autor\ifthenelse{\equal{#1}{female}}{ka}{}
  uveden\'{e} \CZU@levelCZgen{} d\'{a}le prohla\v{s}uji, \v{z}e jsem
  v~souvislosti s~jej\'{i}m vytvo\v{r}en\'{i}m
  neporu\v{s}il\ifthenelse{\equal{#1}{female}}{a}{} autorsk\'{a}
  pr\'{a}va t\v{r}et\'{i}ch osob.
  \medskip
  \noindent
  Prohla\v{s}uji, \v{z}e jsem n\'{a}stroje AI vyu\v{z}il\ifthenelse{\equal{#1}{female}}{a}{}
  v~souladu s~vnit\v{r}n\'{i}mi p\v{r}edpisy univerzity
  a~principy akademick\'{e} integrity a~etiky.
  Na vyu\v{z}it\'{i} t\v{e}chto n\'{a}stroj\r{u} v~pr\'{a}ci
  vhodn\'{y}m zp\r{u}sobem odkazuji.
  \vspace{1.5cm}
  \noindent V~Praze dne \hspace{3cm} \hfill \makebox[5cm]{\dotfill}
  \clearpage
}

%% ===================================================================
%% ABSTRACT + KEYWORDS
%% ===================================================================

\newenvironment{abstractCZ}[1][]{%
  {\noindent\bfseries\fontsize{18pt}{22pt}\selectfont \CZU@title\par}%
  \vspace{15pt}%
  {\noindent\bfseries Abstrakt\par}%
  \vspace{15pt}\noindent\ignorespaces
}{\par\vspace{15pt}}

\newenvironment{abstractEN}[1][]{%
  {\noindent\bfseries\fontsize{18pt}{22pt}\selectfont \CZU@titleEN\par}%
  \vspace{15pt}%
  {\noindent\bfseries Abstract\par}%
  \vspace{15pt}\noindent\ignorespaces
}{\par\vspace{15pt}}

\newenvironment{keywordsCZ}[1][]{%
  \par\noindent\textbf{Kl\'{i}\v{c}ov\'{a} slova:}\space
}{\par\bigskip}

\newenvironment{keywordsEN}[1][]{%
  \par\noindent\textbf{Keywords:}\space
}{\par}

%% ===================================================================
%% ACKNOWLEDGEMENT: text at bottom of page
%% ===================================================================

\newenvironment{acknowledgement}[1][]{%
  \clearpage\thispagestyle{empty}%
  \mbox{}\vfill
  {\noindent\bfseries Pod\v{e}kov\'{a}n\'{i}\par}%
  \vspace{15pt}\noindent\ignorespaces
}{\clearpage}

%% ===================================================================
%% GLOSSARY STYLE: bold abbreviation | description, no trailing period
%% ===================================================================

\AtBeginDocument{%
  \@ifpackageloaded{glossaries-extra}{%
    \renewcommand{\glspostdescription}{}%
    \newglossarystyle{czuabbr}{%
      \setglossarystyle{long}%
      \renewenvironment{theglossary}%
        {\begin{longtable}[l]{@{}p{2cm}p{\dimexpr\linewidth-2cm-2\tabcolsep\relax}@{}}}%
        {\end{longtable}}%
      \renewcommand*{\glossaryheader}{}%
      \renewcommand*{\glsgroupheading}[1]{}%
      \renewcommand*{\glsgroupskip}{}%
      \renewcommand*{\glossentry}[2]{%
        \glsentryitem{##1}\glstarget{##1}{\textbf{\glossentryname{##1}}} &
        \glossentrydesc{##1}\glspostdescription\space ##2\tabularnewline
      }%
    }%
  }{}%
}

%% ===================================================================
%% LIST COMMANDS: headingless \listoffigures etc. for embedding
%% ===================================================================

\newcommand{\CZUlistoffigures}{\@starttoc{lof}}
\newcommand{\CZUlistoftables}{\@starttoc{lot}}
\newcommand{\CZUlistofgrafs}{\@starttoc{logrf}}

%% ===================================================================
%% SOURCE COMMAND: "Zdroj:" below figures/tables
%% ===================================================================

\newcommand{\source}[1]{%
  \par\vspace{2pt}{\small\noindent Zdroj: #1\par}%
}

%% ===================================================================
%% BIBLIOGRAPHY: numbered chapter heading + spacing
%% ===================================================================

\AtBeginDocument{%
  \@ifpackageloaded{biblatex}{%
    \defbibheading{czuchapter}[\bibname]{\chapter{#1}}%
    \setlength{\bibitemsep}{6pt}%
    \setlength{\bibhang}{1.27cm}%  match \parindent
    %% Whole citation clickable (author + year), not just the year.
    %% Standard biblatex snippet for author-year styles with hyperref.
    \DeclareFieldFormat{citehyperref}{%
      \DeclareFieldAlias{bibhyperref}{noformat}%
      \bibhyperref{#1}}%
    \DeclareFieldFormat{textcitehyperref}{%
      \DeclareFieldAlias{bibhyperref}{noformat}%
      \bibhyperref{%
        #1%
        \ifbool{cbx:parens}
          {\bibcloseparen\global\boolfalse{cbx:parens}}
          {}}}%
    \savebibmacro{cite}%
    \savebibmacro{textcite}%
    \renewbibmacro*{cite}{%
      \printtext[citehyperref]{%
        \restorebibmacro{cite}%
        \usebibmacro{cite}}}%
    \renewbibmacro*{textcite}{%
      \ifboolexpr{%
        ( not test {\iffieldundef{prenote}} and
          test {\ifnumequal{\value{citecount}}{1}} )
        or
        ( not test {\iffieldundef{postnote}} and
          test {\ifnumequal{\value{citecount}}{\value{citetotal}}} )%
      }%
        {\DeclareFieldAlias{textcitehyperref}{noformat}}%
        {}%
      \printtext[textcitehyperref]{%
        \restorebibmacro{textcite}%
        \usebibmacro{textcite}}}%
  }{}%
}

%% CODE LISTINGS: minted (pygments), needs xelatex -shell-escape
\ifCZU@code
  \RequirePackage[newfloat]{minted}
  \usemintedstyle{tango}
  \definecolor{codebg}{gray}{0.96}
  \setminted{%
    fontsize=\footnotesize,
    bgcolor=codebg,
    frame=lines,
    framesep=2mm,
    baselinestretch=1.1,
    breaklines=true,
    breakanywhere=true,
    tabsize=2,
    autogobble%
  }
  % minted 3 lets a listing break across pages; keep each listing in one box (all are shorter than a page).
  % The minipage drops the list spacing of fancyvrb (topsep + partopsep), so it is added around the box.
  \newcommand\CZU@listingskip{\@tempskipa=\topsep \advance\@tempskipa\partopsep \addvspace{\@tempskipa}}
  \AddToHook{env/minted/before}{\par\if@nobreak\else\CZU@listingskip\fi\noindent\begin{minipage}{\linewidth}}
  \AddToHook{env/minted/after}{\end{minipage}\par\CZU@listingskip}
\fi

\endinput
