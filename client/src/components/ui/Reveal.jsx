import { motion } from 'framer-motion';

export const EASE = [0.22, 1, 0.36, 1];

/** Fades content up once when it first enters the viewport. Disabled by MotionConfig for reduced motion. */
export default function Reveal({ as = 'div', delay = 0, y = 18, className, children, amount = 0.25, ...rest }) {
  const Comp = motion[as] || motion.div;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** Parent/child variants for staggered lists (e.g. product grids). */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
export const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};
