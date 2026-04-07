import { FaGithub, FaInstagram, FaLinkedinIn } from 'react-icons/fa';

const SOCIAL_LINKS = [
  {
    id: 'instagram',
    label: 'Instagram',
    href: 'http://instagram.com/thedinolino',
    Icon: FaInstagram,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/tin-nguyen-019299279/',
    Icon: FaLinkedinIn,
  },
  {
    id: 'github',
    label: 'GitHub',
    href: 'https://github.com/nntin/leafspots',
    Icon: FaGithub,
  },
] as const;

export default function SidebarSocialIcons() {
  return (
    <section className="social-panel" aria-label="Social links">
      <h2>Connect</h2>
      <div className="social-links" role="list">
        {SOCIAL_LINKS.map(({ id, label, href, Icon }) => (
          <a
            key={id}
            href={href}
            className="social-link"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
            role="listitem"
          >
            <Icon aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}